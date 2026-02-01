#!/usr/bin/env node

/**
 * Railway Service Scheduler
 * ใช้สำหรับตั้งเวลาเปิดปิด Railway services อัตโนมัติ
 */

const RAILWAY_API_URL = "https://backboard.railway.com/graphql/v2";

// กำหนดค่าตั้งเริ่มต้น (แก้ไขตามต้องการ)
const CONFIG = {
  // Service IDs ที่ต้องการควบคุม (คั่นด้วย comma)
  SERVICE_IDS: process.env.RAILWAY_SERVICE_IDS?.split(',') || [],

  // Environment ID (หาได้จาก Railway Dashboard)
  ENVIRONMENT_ID: process.env.RAILWAY_ENVIRONMENT_ID || '',

  // API Token
  API_TOKEN: process.env.RAILWAY_API_TOKEN || '',
};

async function makeRailwayRequest(query, variables = {}) {
  if (!CONFIG.API_TOKEN) {
    throw new Error("RAILWAY_API_TOKEN is not set");
  }

  const response = await fetch(RAILWAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.API_TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();

  if (result.errors) {
    throw new Error(`Railway API Error: ${JSON.stringify(result.errors, null, 2)}`);
  }

  return result.data;
}

async function stopService(serviceId, environmentId) {
  console.log(`Stopping service: ${serviceId}`);

  const mutation = `
    mutation($serviceId: String!, $environmentId: String!) {
      serviceInstanceUpdate(
        serviceId: $serviceId
        environmentId: $environmentId
        input: { numReplicas: 0 }
      )
    }
  `;

  try {
    await makeRailwayRequest(mutation, { serviceId, environmentId });
    console.log(`✅ Service ${serviceId} stopped successfully`);
  } catch (error) {
    console.error(`❌ Failed to stop service ${serviceId}:`, error.message);
    throw error;
  }
}

async function startService(serviceId, environmentId) {
  console.log(`Starting service: ${serviceId}`);

  const mutation = `
    mutation($serviceId: String!, $environmentId: String!) {
      serviceInstanceUpdate(
        serviceId: $serviceId
        environmentId: $environmentId
        input: { numReplicas: 1 }
      )
    }
  `;

  try {
    await makeRailwayRequest(mutation, { serviceId, environmentId });
    console.log(`✅ Service ${serviceId} started successfully`);
  } catch (error) {
    console.error(`❌ Failed to start service ${serviceId}:`, error.message);
    throw error;
  }
}

async function getServiceStatus(serviceId, environmentId) {
  const query = `
    query($serviceId: String!, $environmentId: String!) {
      service(id: $serviceId) {
        id
        name
        serviceInstances(environmentId: $environmentId) {
          edges {
            node {
              numReplicas
              latestDeployment {
                status
              }
            }
          }
        }
      }
    }
  `;

  const data = await makeRailwayRequest(query, { serviceId, environmentId });
  return data.service;
}

async function main() {
  const action = process.argv[2]; // 'start' or 'stop'

  if (!action || !['start', 'stop', 'status'].includes(action)) {
    console.error('Usage: node scheduler.js [start|stop|status]');
    process.exit(1);
  }

  if (!CONFIG.ENVIRONMENT_ID) {
    console.error('❌ RAILWAY_ENVIRONMENT_ID is not set');
    process.exit(1);
  }

  if (CONFIG.SERVICE_IDS.length === 0) {
    console.error('❌ RAILWAY_SERVICE_IDS is not set');
    console.log('Example: export RAILWAY_SERVICE_IDS="service-id-1,service-id-2"');
    process.exit(1);
  }

  console.log(`\n🚂 Railway Scheduler - ${action.toUpperCase()}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Environment: ${CONFIG.ENVIRONMENT_ID}`);
  console.log(`Services: ${CONFIG.SERVICE_IDS.length}\n`);

  try {
    for (const serviceId of CONFIG.SERVICE_IDS) {
      if (action === 'stop') {
        await stopService(serviceId, CONFIG.ENVIRONMENT_ID);
      } else if (action === 'start') {
        await startService(serviceId, CONFIG.ENVIRONMENT_ID);
      } else if (action === 'status') {
        const status = await getServiceStatus(serviceId, CONFIG.ENVIRONMENT_ID);
        console.log(`Service: ${status.name}`);
        console.log(`Status:`, JSON.stringify(status.serviceInstances.edges[0]?.node, null, 2));
      }
    }

    console.log(`\n✅ All services ${action === 'status' ? 'checked' : action + 'ed'} successfully`);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
