// Test Railway API - Stop Service
// ใช้สำหรับทดสอบว่า query deployments ทำงานหรือไม่

const serviceId = 'ใส่ Service ID ที่ต้องการทดสอบ';
const environmentId = 'ใส่ Environment ID';
const railwayToken = 'ใส่ Railway API Token';

const testStopService = async () => {
  console.log('🔍 Testing: Query deployments for STOP action');

  // Step 1: Get deployment to remove
  const getDeploymentQuery = `
    query($serviceId: String!, $environmentId: String!) {
      deployments(
        first: 1
        input: {
          serviceId: $serviceId
          environmentId: $environmentId
          status: SUCCESS
        }
      ) {
        edges {
          node {
            id
            status
            createdAt
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${railwayToken}`
      },
      body: JSON.stringify({
        query: getDeploymentQuery,
        variables: { serviceId, environmentId }
      })
    });

    const result = await response.json();

    console.log('📤 Response:', JSON.stringify(result, null, 2));

    if (result.errors) {
      console.error('❌ GraphQL Errors:', result.errors);
      return;
    }

    const deployment = result.data?.deployments?.edges?.[0]?.node;

    if (!deployment) {
      console.warn('⚠️ No deployment found with status SUCCESS');
      return;
    }

    console.log('✅ Found deployment:', deployment);
    console.log(`📋 Deployment ID: ${deployment.id}`);
    console.log(`📅 Created: ${deployment.createdAt}`);

    // Step 2: Remove the deployment
    console.log('\n🛑 Testing: Remove deployment mutation');

    const removeQuery = `
      mutation($id: String!) {
        deploymentRemove(id: $id)
      }
    `;

    const removeResponse = await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${railwayToken}`
      },
      body: JSON.stringify({
        query: removeQuery,
        variables: { id: deployment.id }
      })
    });

    const removeResult = await removeResponse.json();
    console.log('📤 Remove Response:', JSON.stringify(removeResult, null, 2));

    if (removeResult.errors) {
      console.error('❌ Remove Errors:', removeResult.errors);
      return;
    }

    console.log('✅ Deployment removed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

// testStopService();

console.log(`
⚠️ คำแนะนำ:
1. แก้ไข serviceId, environmentId, และ railwayToken ด้านบน
2. Uncomment บรรทัด testStopService()
3. รันด้วย: node test-railway-stop.js
`);
