import { createClient } from "jsr:@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RAILWAY_API_URL = "https://backboard.railway.com/graphql/v2";

Deno.serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract JWT token from Authorization header
    const token = authHeader.replace("Bearer ", "");

    // Use service role to validate the token
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from token
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error("Auth error:", userError?.message || "No user");
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: userError?.message }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ User authenticated:", user.email);

    // Get Railway API token from database (reusing supabaseAdmin created above)
    const { data: settingsData, error: settingsError } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "railway_api_token")
      .single();

    if (settingsError) {
      console.error("Failed to get Railway token:", settingsError);
      return new Response(
        JSON.stringify({ error: "Railway API token not configured", details: settingsError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!settingsData?.value) {
      console.error("Railway token is empty");
      return new Response(
        JSON.stringify({ error: "Railway API token not configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const railwayToken = settingsData.value;
    console.log("✅ Railway token loaded");

    // Parse request body
    const { query, variables, action, serviceId, environmentId, checkActiveDeployment } = await req.json();
    console.log("📥 Request:", { action, hasQuery: !!query, hasServiceId: !!serviceId, checkActiveDeployment });

    // If checking for active deployments, add it to the query
    if (checkActiveDeployment && serviceId && environmentId) {
      console.log("🔍 Checking for active deployment");

      // First execute the original query
      const response1 = await fetch(RAILWAY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${railwayToken}`,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      const result1 = await response1.json();

      // Then check for active deployments
      const deploymentsQuery = `
        query($serviceId: String!, $environmentId: String!) {
          service(id: $serviceId) {
            id
            deployments(first: 5) {
              edges {
                node {
                  id
                  status
                  environment {
                    id
                  }
                  createdAt
                }
              }
            }
          }
        }
      `;

      const response2 = await fetch(RAILWAY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${railwayToken}`,
        },
        body: JSON.stringify({
          query: deploymentsQuery,
          variables: { serviceId, environmentId },
        }),
      });

      const result2 = await response2.json();

      // Check if deployment query has errors
      if (result2.errors) {
        console.warn("⚠️ Deployment query failed, falling back to basic status");
        // Return original result without active deployment check
        return new Response(JSON.stringify({
          ...result1.data,
          hasActiveDeployment: undefined, // Will use latestDeployment.status instead
          activeDeploymentCount: 0
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Filter deployments for this environment and check for active ones
      const activeDeployments = result2.data?.service?.deployments?.edges?.filter((edge: any) => {
        const deployment = edge.node;
        return deployment.environment.id === environmentId &&
               deployment.status === 'SUCCESS';
      }) || [];

      console.log("✅ Active deployments:", activeDeployments.length);

      // Combine results
      return new Response(JSON.stringify({
        ...result1.data,
        hasActiveDeployment: activeDeployments.length > 0,
        activeDeploymentCount: activeDeployments.length
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If it's a direct action (start/stop), handle it differently
    let finalQuery = query;
    let finalVariables = variables;

    if (action === "start" || action === "stop") {
      console.log(`🔄 Action: ${action} service ${serviceId}`);

      if (action === "stop") {
        // For STOP: Get latestDeployment from service instance
        const getServiceQuery = `
          query($serviceId: String!) {
            service(id: $serviceId) {
              id
              serviceInstances {
                edges {
                  node {
                    environmentId
                    latestDeployment {
                      id
                      status
                    }
                  }
                }
              }
            }
          }
        `;

        const serviceResponse = await fetch(RAILWAY_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${railwayToken}`,
          },
          body: JSON.stringify({
            query: getServiceQuery,
            variables: { serviceId },
          }),
        });

        const serviceResult = await serviceResponse.json();

        // Find the instance for this environment
        const instance = serviceResult.data?.service?.serviceInstances?.edges?.find(
          (edge: any) => edge.node.environmentId === environmentId
        )?.node;

        if (!instance?.latestDeployment?.id) {
          console.log("⚠️ No deployment found for this service");
          return new Response(
            JSON.stringify({ message: "No deployment found to stop" }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Remove the deployment to stop the service
        finalQuery = `
          mutation($id: String!) {
            deploymentRemove(id: $id)
          }
        `;
        finalVariables = { id: instance.latestDeployment.id };
        console.log(`🛑 Removing deployment ${instance.latestDeployment.id} (status: ${instance.latestDeployment.status})`);
      } else {
        // For START: Trigger a new deployment (redeploy)
        finalQuery = `
          mutation($serviceId: String!, $environmentId: String!) {
            serviceInstanceRedeploy(
              serviceId: $serviceId
              environmentId: $environmentId
            )
          }
        `;
        finalVariables = { serviceId, environmentId };
        console.log(`🚀 Redeploying service`);
      }
    }

    // Call Railway API
    console.log("🚂 Calling Railway API...");
    const response = await fetch(RAILWAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${railwayToken}`,
      },
      body: JSON.stringify({
        query: finalQuery,
        variables: finalVariables,
      }),
    });

    const result = await response.json();
    console.log("📤 Railway response status:", response.status);

    if (result.errors) {
      console.error("❌ Railway API errors:", result.errors);
      return new Response(
        JSON.stringify({ error: "Railway API Error", details: result.errors }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ Success!");
    return new Response(JSON.stringify(result.data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
