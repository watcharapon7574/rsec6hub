#!/usr/bin/env node

/**
 * ทดสอบการเชื่อมต่อ Railway API
 */

const RAILWAY_API_URL = "https://backboard.railway.com/graphql/v2";

async function testRailwayAPI() {
  const apiToken = process.env.RAILWAY_API_TOKEN;

  if (!apiToken) {
    console.error('❌ RAILWAY_API_TOKEN is not set');
    console.log('\nSet it with:');
    console.log('  export RAILWAY_API_TOKEN="your_token_here"');
    console.log('\nGet your token from: https://railway.com/account/tokens');
    process.exit(1);
  }

  console.log('🔍 Testing Railway API connection...\n');

  try {
    // Test 1: Get user info
    console.log('Test 1: Getting user information...');
    const userQuery = `
      query {
        me {
          id
          name
          email
        }
      }
    `;

    const userResponse = await fetch(RAILWAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ query: userQuery }),
    });

    const userData = await userResponse.json();

    if (userData.errors) {
      console.error('❌ API Error:', JSON.stringify(userData.errors, null, 2));
      process.exit(1);
    }

    console.log('✅ User Info:');
    console.log(`   Name: ${userData.data.me.name}`);
    console.log(`   Email: ${userData.data.me.email}`);
    console.log(`   ID: ${userData.data.me.id}\n`);

    // Test 2: List projects
    console.log('Test 2: Listing projects...');
    const projectsQuery = `
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

    const projectsResponse = await fetch(RAILWAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ query: projectsQuery }),
    });

    const projectsData = await projectsResponse.json();

    if (projectsData.errors) {
      console.error('❌ API Error:', JSON.stringify(projectsData.errors, null, 2));
      process.exit(1);
    }

    const projects = projectsData.data.projects.edges;
    console.log(`✅ Found ${projects.length} project(s):\n`);

    for (const { node: project } of projects) {
      console.log(`   📦 ${project.name}`);
      console.log(`      ID: ${project.id}`);
      if (project.description) {
        console.log(`      Description: ${project.description}`);
      }

      // List services in this project
      const servicesQuery = `
        query($projectId: String!) {
          project(id: $projectId) {
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

      const servicesResponse = await fetch(RAILWAY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          query: servicesQuery,
          variables: { projectId: project.id },
        }),
      });

      const servicesData = await servicesResponse.json();

      if (!servicesData.errors) {
        const services = servicesData.data.project.services.edges;
        const environments = servicesData.data.project.environments.edges;

        console.log(`      Services: ${services.length}`);
        services.forEach(({ node: service }) => {
          console.log(`         - ${service.name} (${service.id})`);
        });

        console.log(`      Environments: ${environments.length}`);
        environments.forEach(({ node: env }) => {
          console.log(`         - ${env.name} (${env.id})`);
        });
      }

      console.log();
    }

    console.log('✅ All tests passed!\n');
    console.log('📝 Next steps:');
    console.log('   1. Copy a Service ID and Environment ID from above');
    console.log('   2. Set environment variables:');
    console.log('      export RAILWAY_SERVICE_IDS="service-id-1,service-id-2"');
    console.log('      export RAILWAY_ENVIRONMENT_ID="environment-id"');
    console.log('   3. Test the scheduler:');
    console.log('      node scheduler.js status');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testRailwayAPI();
