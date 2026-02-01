import { supabase } from "@/integrations/supabase/client";

export interface RailwayService {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  environmentId: string;
  environmentName: string;
  status?: 'running' | 'stopped' | 'unknown';
  numReplicas?: number;
}

export interface RailwaySchedule {
  id?: string;
  service_id: string;
  service_name: string;
  environment_id: string;
  start_time: string; // HH:MM format
  stop_time: string;  // HH:MM format
  days_of_week: number[]; // 0-6 (0 = Sunday)
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

class RailwayService {
  private apiToken: string | null = null;

  async getApiToken(): Promise<string> {
    if (this.apiToken) return this.apiToken;

    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'railway_api_token')
      .single();

    if (error || !data?.value) {
      throw new Error('Railway API token not configured');
    }

    this.apiToken = data.value;
    return this.apiToken;
  }

  async saveApiToken(token: string): Promise<void> {
    const { error } = await supabase
      .from('app_settings')
      .upsert({
        key: 'railway_api_token',
        value: token,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    this.apiToken = token;
  }

  private async makeRailwayRequest(query: string, variables: any = {}, options?: { checkActiveDeployment?: boolean, serviceId?: string, environmentId?: string }) {
    // Get Supabase session for authentication
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('User not authenticated');
    }

    // Call Edge Function instead of Railway API directly (to avoid CORS)
    const { data, error } = await supabase.functions.invoke('railway-api', {
      body: {
        query,
        variables,
        checkActiveDeployment: options?.checkActiveDeployment,
        serviceId: options?.serviceId,
        environmentId: options?.environmentId
      }
    });

    if (error) {
      throw new Error(`Edge Function Error: ${error.message}`);
    }

    if (data?.error) {
      throw new Error(`Railway API Error: ${JSON.stringify(data.error)}`);
    }

    return data;
  }

  async listProjects() {
    const query = `
      query {
        projects {
          edges {
            node {
              id
              name
              description
            }
          }
        }
      }
    `;

    const data = await this.makeRailwayRequest(query);
    return data.projects.edges.map((e: any) => e.node);
  }

  async listServices(projectId: string) {
    const query = `
      query($projectId: String!) {
        project(id: $projectId) {
          id
          name
          services {
            edges {
              node {
                id
                name
              }
            }
          }
          environments {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `;

    const data = await this.makeRailwayRequest(query, { projectId });
    return data.project;
  }

  async getServiceStatus(serviceId: string, environmentId: string) {
    // Simple query - get service instance info only
    const query = `
      query($serviceId: String!) {
        service(id: $serviceId) {
          id
          name
          serviceInstances {
            edges {
              node {
                environmentId
                numReplicas
                builder
                latestDeployment {
                  id
                  status
                  createdAt
                  staticUrl
                }
              }
            }
          }
        }
      }
    `;

    // Request with active deployment check for static sites
    const data = await this.makeRailwayRequest(query, { serviceId }, {
      checkActiveDeployment: true,
      serviceId,
      environmentId
    });

    // Filter by environmentId on client side
    const instance = data.service.serviceInstances.edges.find(
      (edge: any) => edge.node.environmentId === environmentId
    )?.node;

    if (!instance) {
      console.warn('⚠️ No instance found for environmentId:', environmentId);
      return {
        ...data.service,
        numReplicas: 0,
        status: 'stopped',
        deploymentStatus: 'NONE',
        isStaticSite: false
      };
    }

    const deploymentStatus = instance.latestDeployment?.status;
    const isStaticSite = !!instance.latestDeployment?.staticUrl;
    const hasActiveDeployment = data.hasActiveDeployment;

    // Determine status based on deployment status
    let status: 'running' | 'stopped' | 'unknown' = 'unknown';

    if (isStaticSite) {
      // For static sites, check hasActiveDeployment if available
      if (hasActiveDeployment !== undefined) {
        status = hasActiveDeployment ? 'running' : 'stopped';
      } else {
        // Fallback: use latestDeployment.status
        status = deploymentStatus === 'SUCCESS' ? 'running' : 'stopped';
      }
    }
    // Check if it has numReplicas (regular service)
    else if (instance.numReplicas !== null && instance.numReplicas !== undefined) {
      status = instance.numReplicas > 0 ? 'running' : 'stopped';
    }
    // Fallback: check active deployments or deployment status
    else {
      if (hasActiveDeployment !== undefined) {
        status = hasActiveDeployment ? 'running' : 'stopped';
      } else {
        status = deploymentStatus === 'SUCCESS' ? 'running' : 'stopped';
      }
    }

    console.log('🔍 Service status:', {
      name: data.service.name,
      numReplicas: instance.numReplicas,
      deploymentStatus,
      staticUrl: instance.latestDeployment?.staticUrl,
      isStaticSite,
      hasActiveDeployment,
      activeDeploymentCount: data.activeDeploymentCount,
      determinedStatus: status
    });

    return {
      ...data.service,
      numReplicas: instance.numReplicas ?? 0,
      status,
      deploymentStatus,
      isStaticSite
    };
  }

  async startService(serviceId: string, environmentId: string) {
    // Get Supabase session
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('User not authenticated');
    }

    // Call Edge Function with action
    const { data, error } = await supabase.functions.invoke('railway-api', {
      body: {
        action: 'start',
        serviceId,
        environmentId
      }
    });

    if (error) {
      throw new Error(`Edge Function Error: ${error.message}`);
    }

    if (data?.error) {
      throw new Error(`Railway API Error: ${JSON.stringify(data.error)}`);
    }

    return { success: true, message: 'Service started' };
  }

  async stopService(serviceId: string, environmentId: string) {
    // Get Supabase session
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('User not authenticated');
    }

    // Call Edge Function with action
    const { data, error } = await supabase.functions.invoke('railway-api', {
      body: {
        action: 'stop',
        serviceId,
        environmentId
      }
    });

    if (error) {
      throw new Error(`Edge Function Error: ${error.message}`);
    }

    if (data?.error) {
      throw new Error(`Railway API Error: ${JSON.stringify(data.error)}`);
    }

    return { success: true, message: 'Service stopped' };
  }

  // Schedule Management
  async getSchedules(): Promise<RailwaySchedule[]> {
    const { data, error } = await supabase
      .from('railway_schedules')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async createSchedule(schedule: Omit<RailwaySchedule, 'id' | 'created_at' | 'updated_at'>): Promise<RailwaySchedule> {
    const { data, error } = await supabase
      .from('railway_schedules')
      .insert(schedule)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateSchedule(id: string, schedule: Partial<RailwaySchedule>): Promise<RailwaySchedule> {
    const { data, error } = await supabase
      .from('railway_schedules')
      .update({ ...schedule, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteSchedule(id: string): Promise<void> {
    const { error } = await supabase
      .from('railway_schedules')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async toggleSchedule(id: string, enabled: boolean): Promise<void> {
    await this.updateSchedule(id, { enabled });
  }
}

export const railwayService = new RailwayService();
