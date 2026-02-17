// Example Plugin: California GetCalFresh
// Demonstrates both declarative and JavaScript tool definitions

/**
 * OPTION 1: DECLARATIVE PLUGIN (RECOMMENDED FOR SIMPLE SITES)
 * 
 * Pure JSON configuration - no JavaScript required
 * Safer, easier to review, automatically sandboxed
 */

// declarative-plugin.json
{
  "id": "gov.california.getcalfresh",
  "name": "California GetCalFresh",
  "version": "1.0.0",
  "author": "Code for America",
  "authorUrl": "https://codeforamerica.org",
  "description": "WebMCP tools for California SNAP (CalFresh) application",
  "homepage": "https://www.getcalfresh.org",
  "repository": "https://github.com/civic-mcp/plugin-california-getcalfresh",
  "license": "MIT",
  
  "domains": [
    "www.getcalfresh.org",
    "*.getcalfresh.org"
  ],
  
  "declarative": true,
  
  "tools": [
    {
      "name": "check_eligibility",
      "description": "Pre-screen CalFresh eligibility based on household income and size",
      "category": "eligibility",
      
      "navigation": {
        "url": "https://www.getcalfresh.org/en/pre-screen",
        "waitForSelector": "form#pre-screen-form"
      },
      
      "inputs": {
        "zipCode": {
          "selector": "input[name='zip_code']",
          "type": "text",
          "required": true,
          "description": "California ZIP code"
        },
        "householdSize": {
          "selector": "input[name='household_size']",
          "type": "number",
          "required": true,
          "description": "Number of people in household"
        },
        "monthlyIncome": {
          "selector": "input[name='monthly_income']",
          "type": "number",
          "required": true,
          "description": "Total monthly gross income"
        },
        "hasDisabledMember": {
          "selector": "input[name='has_disabled_member']",
          "type": "checkbox",
          "description": "Household includes someone with a disability"
        },
        "hasElderlyMember": {
          "selector": "input[name='has_elderly_member']",
          "type": "checkbox",
          "description": "Household includes someone 60 or older"
        }
      },
      
      "submit": {
        "selector": "button[type='submit']",
        "waitForSelector": ".eligibility-result"
      },
      
      "output": {
        "eligible": {
          "selector": ".eligibility-result .status",
          "type": "boolean",
          "description": "Whether household is likely eligible"
        },
        "estimatedBenefit": {
          "selector": ".eligibility-result .benefit-amount",
          "type": "number",
          "description": "Estimated monthly benefit amount"
        },
        "message": {
          "selector": ".eligibility-result .message",
          "type": "text",
          "description": "Eligibility explanation"
        }
      }
    },
    
    {
      "name": "start_application",
      "description": "Begin CalFresh application with basic contact information",
      "category": "application",
      
      "navigation": {
        "url": "https://www.getcalfresh.org/en/apply",
        "waitForSelector": "form#application-form"
      },
      
      "inputs": {
        "firstName": {
          "selector": "input[name='first_name']",
          "type": "text",
          "required": true
        },
        "lastName": {
          "selector": "input[name='last_name']",
          "type": "text",
          "required": true
        },
        "phoneNumber": {
          "selector": "input[name='phone_number']",
          "type": "text",
          "required": true,
          "format": "phone"
        },
        "email": {
          "selector": "input[name='email']",
          "type": "text",
          "required": false,
          "format": "email"
        },
        "preferredLanguage": {
          "selector": "select[name='preferred_language']",
          "type": "select",
          "options": ["English", "Spanish", "Chinese", "Vietnamese"]
        }
      },
      
      "submit": {
        "selector": "button.continue-button",
        "waitForSelector": ".application-started"
      },
      
      "output": {
        "applicationId": {
          "selector": ".application-id",
          "type": "text"
        },
        "nextStepUrl": {
          "selector": ".next-step-link",
          "type": "attribute",
          "attribute": "href"
        }
      }
    }
  ],
  
  "permissions": {
    "required": [
      "read:forms",
      "write:forms"
    ],
    "optional": [
      "storage:local"
    ]
  },
  
  "metadata": {
    "lastUpdated": "2026-02-16",
    "verified": true,
    "officialPartner": "Code for America"
  }
}

/**
 * OPTION 2: JAVASCRIPT PLUGIN (FOR COMPLEX INTERACTIONS)
 * 
 * Full JavaScript with access to sandboxed APIs
 * More powerful but requires code review for verification
 */

// javascript-plugin.js
export default {
  id: 'gov.california.getcalfresh',
  name: 'California GetCalFresh',
  version: '1.0.0',
  
  // Called when plugin loads
  async init(context) {
    const { storage, notify } = context;
    
    console.log('[GetCalFresh] Plugin initialized');
    
    // Load saved preferences
    const prefs = await storage.get('preferences');
    if (prefs) {
      console.log('[GetCalFresh] Loaded preferences:', prefs);
    }
    
    // Show welcome message on first load
    const hasSeenWelcome = await storage.get('hasSeenWelcome');
    if (!hasSeenWelcome) {
      notify.info('GetCalFresh plugin loaded! 2 new tools available.');
      await storage.set('hasSeenWelcome', true);
    }
  },
  
  tools: [
    {
      name: 'check_eligibility',
      description: 'Pre-screen CalFresh eligibility with detailed calculation',
      
      inputSchema: {
        type: 'object',
        properties: {
          zipCode: {
            type: 'string',
            pattern: '^[0-9]{5}$',
            description: 'California ZIP code'
          },
          householdSize: {
            type: 'integer',
            minimum: 1,
            description: 'Number of people in household'
          },
          monthlyIncome: {
            type: 'number',
            minimum: 0,
            description: 'Total monthly gross income'
          },
          monthlyExpenses: {
            type: 'object',
            properties: {
              rent: { type: 'number', minimum: 0 },
              utilities: { type: 'number', minimum: 0 },
              childCare: { type: 'number', minimum: 0 },
              medicalCosts: { type: 'number', minimum: 0 }
            }
          },
          hasDisabledMember: {
            type: 'boolean'
          },
          hasElderlyMember: {
            type: 'boolean'
          }
        },
        required: ['zipCode', 'householdSize', 'monthlyIncome']
      },
      
      async execute(params, context) {
        const { page, storage, notify, utils } = context;
        
        try {
          notify.info('Checking CalFresh eligibility...');
          
          // Navigate to eligibility checker
          await page.navigate('https://www.getcalfresh.org/en/pre-screen');
          await page.waitForSelector('form#pre-screen-form');
          
          // Fill basic information
          await page.fillField('input[name="zip_code"]', params.zipCode);
          await page.fillField('input[name="household_size"]', params.householdSize.toString());
          await page.fillField('input[name="monthly_income"]', params.monthlyIncome.toString());
          
          // Fill optional expenses if provided
          if (params.monthlyExpenses) {
            await page.fillField('input[name="rent"]', params.monthlyExpenses.rent?.toString() || '0');
            await page.fillField('input[name="utilities"]', params.monthlyExpenses.utilities?.toString() || '0');
            await page.fillField('input[name="child_care"]', params.monthlyExpenses.childCare?.toString() || '0');
            await page.fillField('input[name="medical"]', params.monthlyExpenses.medicalCosts?.toString() || '0');
          }
          
          // Check boxes for household composition
          if (params.hasDisabledMember) {
            await page.click('input[name="has_disabled_member"]');
          }
          if (params.hasElderlyMember) {
            await page.click('input[name="has_elderly_member"]');
          }
          
          // Submit form
          await page.click('button[type="submit"]');
          await page.waitForSelector('.eligibility-result');
          
          // Give page time to render
          await utils.sleep(500);
          
          // Extract results
          const statusText = await page.getText('.eligibility-result .status');
          const eligible = statusText.toLowerCase().includes('eligible') && 
                          !statusText.toLowerCase().includes('not eligible');
          
          const benefitAmountText = await page.getText('.eligibility-result .benefit-amount');
          const estimatedBenefit = parseFloat(benefitAmountText.replace(/[^0-9.]/g, '')) || 0;
          
          const message = await page.getText('.eligibility-result .message');
          
          // Calculate additional details (California-specific logic)
          const grossIncomeLimit = this.getGrossIncomeLimit(params.householdSize);
          const netIncomeLimit = this.getNetIncomeLimit(params.householdSize);
          
          const result = {
            success: true,
            eligible,
            estimatedBenefit,
            message,
            details: {
              grossIncomeLimit,
              netIncomeLimit,
              meetsGrossIncomeTest: params.monthlyIncome <= grossIncomeLimit,
              householdSize: params.householdSize
            }
          };
          
          // Cache result for 24 hours
          await storage.set('lastEligibilityCheck', {
            params,
            result,
            timestamp: Date.now()
          });
          
          notify.info(`Eligibility check complete: ${eligible ? 'Eligible' : 'Not eligible'}`);
          
          return result;
          
        } catch (error) {
          notify.error(`Eligibility check failed: ${error.message}`);
          
          return {
            success: false,
            error: error.message
          };
        }
      },
      
      // Helper method: California gross income limits (2024)
      getGrossIncomeLimit(householdSize) {
        const limits = {
          1: 2266, 2: 3052, 3: 3840, 4: 4626, 
          5: 5412, 6: 6200, 7: 6986, 8: 7772
        };
        return limits[Math.min(householdSize, 8)] || limits[8] + ((householdSize - 8) * 786);
      },
      
      // Helper method: California net income limits (2024)
      getNetIncomeLimit(householdSize) {
        const limits = {
          1: 1354, 2: 1832, 3: 2311, 4: 2789,
          5: 3268, 6: 3747, 7: 4225, 8: 4704
        };
        return limits[Math.min(householdSize, 8)] || limits[8] + ((householdSize - 8) * 479);
      }
    },
    
    {
      name: 'start_application',
      description: 'Begin CalFresh application with full contact and household information',
      
      inputSchema: {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          middleName: { type: 'string' },
          dateOfBirth: { type: 'string', format: 'date' },
          ssn: { type: 'string', pattern: '^[0-9]{3}-[0-9]{2}-[0-9]{4}$' },
          phoneNumber: { type: 'string' },
          email: { type: 'string', format: 'email' },
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
              state: { type: 'string', enum: ['CA'] },
              zip: { type: 'string', pattern: '^[0-9]{5}$' }
            },
            required: ['street', 'city', 'zip']
          },
          preferredLanguage: {
            type: 'string',
            enum: ['English', 'Spanish', 'Chinese', 'Vietnamese', 'Korean', 'Russian', 'Arabic']
          }
        },
        required: ['firstName', 'lastName', 'dateOfBirth', 'phoneNumber', 'address']
      },
      
      async execute(params, context) {
        const { page, storage, notify } = context;
        
        try {
          notify.info('Starting CalFresh application...');
          
          // Navigate to application
          await page.navigate('https://www.getcalfresh.org/en/apply');
          await page.waitForSelector('form#application-form');
          
          // Fill personal information
          await page.fillField('input[name="first_name"]', params.firstName);
          await page.fillField('input[name="last_name"]', params.lastName);
          if (params.middleName) {
            await page.fillField('input[name="middle_name"]', params.middleName);
          }
          await page.fillField('input[name="date_of_birth"]', params.dateOfBirth);
          
          // Fill contact information
          await page.fillField('input[name="phone_number"]', params.phoneNumber);
          if (params.email) {
            await page.fillField('input[name="email"]', params.email);
          }
          
          // Fill address
          await page.fillField('input[name="street_address"]', params.address.street);
          await page.fillField('input[name="city"]', params.address.city);
          await page.fillField('input[name="zip_code"]', params.address.zip);
          
          // Select language preference
          if (params.preferredLanguage) {
            await page.fillField('select[name="preferred_language"]', params.preferredLanguage);
          }
          
          // Submit initial page
          await page.click('button.continue-button');
          await page.waitForSelector('.application-started');
          
          // Extract application ID
          const applicationId = await page.getText('.application-id');
          const nextStepUrl = await page.getText('.next-step-link');
          
          // Save application info
          await storage.set('currentApplication', {
            applicationId,
            startedAt: Date.now(),
            applicant: {
              firstName: params.firstName,
              lastName: params.lastName
            }
          });
          
          notify.info(`Application started! ID: ${applicationId}`);
          
          return {
            success: true,
            applicationId,
            nextStepUrl,
            message: 'Application started successfully. Continue with household information.'
          };
          
        } catch (error) {
          notify.error(`Application start failed: ${error.message}`);
          
          return {
            success: false,
            error: error.message
          };
        }
      }
    }
  ]
};

/**
 * OPTION 3: HYBRID PLUGIN (RECOMMENDED FOR MEDIUM COMPLEXITY)
 * 
 * Declarative definitions with JavaScript helpers
 * Best of both worlds: safety + flexibility
 */

// hybrid-plugin.js
export default {
  id: 'gov.california.getcalfresh',
  
  // Declarative tool definitions
  declarativeTools: [
    // Simple tools defined in JSON
    // (same as Option 1)
  ],
  
  // JavaScript helpers for complex logic
  helpers: {
    async calculateBenefit(params, context) {
      // Complex benefit calculation logic
      // Called by declarative tools
    },
    
    async validateSSN(ssn, context) {
      // SSN validation logic
    }
  },
  
  // JavaScript tools for complex workflows
  tools: [
    // Complex tools that need full JavaScript
    // (same as Option 2)
  ]
};
