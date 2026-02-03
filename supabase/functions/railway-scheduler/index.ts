import { createClient } from "jsr:@supabase/supabase-js@2";

const RAILWAY_API_URL = "https://backboard.railway.com/graphql/v2";

interface Schedule {
  id: string;
  service_id: string;
  service_name: string;
  environment_id: string;
  start_time: string;
  stop_time: string;
  days_of_week: number[];
  enabled: boolean;
}

Deno.serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get Railway API token
    const { data: settingsData, error: settingsError } = await supabaseClient
      .from("app_settings")
      .select("value")
      .eq("key", "railway_api_token")
      .single();

    if (settingsError || !settingsData?.value) {
      console.error("Railway API token not found");
      return new Response(
        JSON.stringify({ error: "Railway API token not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const railwayToken = settingsData.value;

    // Get current time and day
    const now = new Date();
    const currentDay = now.getDay(); // 0-6 (0 = Sunday)
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    console.log(`Running scheduler at ${currentTime} on day ${currentDay}`);

    // Get all enabled schedules
    const { data: schedules, error: schedulesError } = await supabaseClient
      .from("railway_schedules")
      .select("*")
      .eq("enabled", true);

    if (schedulesError) {
      throw schedulesError;
    }

    if (!schedules || schedules.length === 0) {
      console.log("No enabled schedules found");
      return new Response(
        JSON.stringify({ message: "No enabled schedules" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const schedule of schedules as Schedule[]) {
      // Check if schedule should run today
      if (!schedule.days_of_week.includes(currentDay)) {
        console.log(`Schedule ${schedule.id} not scheduled for day ${currentDay}`);
        continue;
      }

      // Check if it's time to start or stop
      let action: "start" | "stop" | null = null;

      // Allow 5 minute window for cron jobs
      const isStartTime = isTimeMatch(currentTime, schedule.start_time, 5);
      const isStopTime = isTimeMatch(currentTime, schedule.stop_time, 5);

      if (isStartTime) {
        action = "start";
      } else if (isStopTime) {
        action = "stop";
      }
      // NEW: If not in time window, check if we should enforce the current state
      else {
        const shouldBeRunning = isWithinWorkingHours(currentTime, schedule.start_time, schedule.stop_time);

        // Get current service status from Railway
        const statusQuery = `
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

        const statusResponse = await fetch(RAILWAY_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${railwayToken}`,
          },
          body: JSON.stringify({
            query: statusQuery,
            variables: { serviceId: schedule.service_id },
          }),
        });

        const statusResult = await statusResponse.json();
        const instance = statusResult.data?.service?.serviceInstances?.edges?.find(
          (edge: any) => edge.node.environmentId === schedule.environment_id
        )?.node;

        const isRunning = !!instance?.latestDeployment?.id;

        // If service state doesn't match what it should be, fix it
        if (shouldBeRunning && !isRunning) {
          console.log(`⚠️ Service ${schedule.service_name} should be running but is stopped. Starting now...`);
          action = "start";
        } else if (!shouldBeRunning && isRunning) {
          console.log(`⚠️ Service ${schedule.service_name} should be stopped but is running. Stopping now...`);
          action = "stop";
        }
      }

      if (!action) {
        continue;
      }

      console.log(`Executing ${action} for service ${schedule.service_name}`);

      try {
        let mutation = "";
        let variables: any = {};

        if (action === "stop") {
          // For STOP: Get latestDeployment from service instance first
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
              variables: { serviceId: schedule.service_id },
            }),
          });

          const serviceResult = await serviceResponse.json();

          // Find the instance for this environment
          const instance = serviceResult.data?.service?.serviceInstances?.edges?.find(
            (edge: any) => edge.node.environmentId === schedule.environment_id
          )?.node;

          if (!instance?.latestDeployment?.id) {
            console.log(`⚠️ No deployment found for ${schedule.service_name}`);
            continue;
          }

          // Remove the deployment to stop the service
          mutation = `
            mutation($id: String!) {
              deploymentRemove(id: $id)
            }
          `;
          variables = { id: instance.latestDeployment.id };
          console.log(`🛑 Removing deployment ${instance.latestDeployment.id}`);
        } else {
          // For START: Trigger a new deployment (redeploy)
          mutation = `
            mutation($serviceId: String!, $environmentId: String!) {
              serviceInstanceRedeploy(
                serviceId: $serviceId
                environmentId: $environmentId
              )
            }
          `;
          variables = {
            serviceId: schedule.service_id,
            environmentId: schedule.environment_id,
          };
          console.log(`🚀 Redeploying service`);
        }

        const response = await fetch(RAILWAY_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${railwayToken}`,
          },
          body: JSON.stringify({
            query: mutation,
            variables: variables,
          }),
        });

        const result = await response.json();

        if (result.errors) {
          throw new Error(JSON.stringify(result.errors));
        }

        // Log success
        await supabaseClient.from("railway_logs").insert({
          schedule_id: schedule.id,
          service_id: schedule.service_id,
          service_name: schedule.service_name,
          action,
          status: "success",
          triggered_by: "schedule",
        });

        results.push({
          schedule_id: schedule.id,
          service_name: schedule.service_name,
          action,
          status: "success",
        });

        console.log(`✅ Successfully ${action}ed ${schedule.service_name}`);
      } catch (error) {
        console.error(`❌ Failed to ${action} ${schedule.service_name}:`, error);

        // Log failure
        await supabaseClient.from("railway_logs").insert({
          schedule_id: schedule.id,
          service_id: schedule.service_id,
          service_name: schedule.service_name,
          action,
          status: "failed",
          error_message: error.message,
          triggered_by: "schedule",
        });

        results.push({
          schedule_id: schedule.id,
          service_name: schedule.service_name,
          action,
          status: "failed",
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Scheduler executed",
        time: currentTime,
        day: currentDay,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Scheduler error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

// Helper function to check if current time matches schedule time (with tolerance)
function isTimeMatch(currentTime: string, scheduleTime: string, toleranceMinutes: number): boolean {
  const [currentHour, currentMinute] = currentTime.split(':').map(Number);
  const [scheduleHour, scheduleMinute] = scheduleTime.split(':').map(Number);

  const currentMinutes = currentHour * 60 + currentMinute;
  const scheduleMinutes = scheduleHour * 60 + scheduleMinute;

  const diff = Math.abs(currentMinutes - scheduleMinutes);

  return diff <= toleranceMinutes;
}

// Helper function to check if current time is within working hours
function isWithinWorkingHours(currentTime: string, startTime: string, stopTime: string): boolean {
  const [currentHour, currentMinute] = currentTime.split(':').map(Number);
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [stopHour, stopMinute] = stopTime.split(':').map(Number);

  const currentMinutes = currentHour * 60 + currentMinute;
  const startMinutes = startHour * 60 + startMinute;
  const stopMinutes = stopHour * 60 + stopMinute;

  return currentMinutes >= startMinutes && currentMinutes < stopMinutes;
}
