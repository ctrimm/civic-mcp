# Contributing a Plugin to Civic-MCP

## Complete Contributor Workflow

This guide walks through creating and submitting a plugin for a government website. We'll use **Texas YourTexasBenefits** as an example.

## Prerequisites

- Node.js 18+ installed
- Chrome 146+ with WebMCP enabled
- GitHub account
- Familiarity with the target government website

## Step 1: Install CLI Tools

```bash
npm install -g @civic-mcp/cli
```

This installs the Civic-MCP CLI for scaffolding and testing plugins.

## Step 2: Research the Target Site

Before writing code, explore the government website:

### Gather Information

1. **Base URLs**
   ```
   Main site: https://yourtexasbenefits.com
   Application: https://yourtexasbenefits.com/Learn/Home
   Status check: https://yourtexasbenefits.com/CaseStatus
   ```

2. **Available Programs**
   - SNAP (food assistance)
   - TANF (cash assistance)
   - Medicaid
   - CHIP (children's health insurance)

3. **Form Structure**
   - Open DevTools (F12)
   - Navigate through application process
   - Note form selectors, field names, validation

4. **Authentication**
   - Does it require login? Yes
   - Login method? Username/password
   - Session type? Cookie-based

### Document Key Selectors

Create a mapping document:

```
Application Start Form:
- First Name: input[name="firstName"]
- Last Name: input[name="lastName"]
- DOB: input[name="dateOfBirth"]
- Submit: button#btnContinue

Status Check Form:
- Application Number: input#applicationNumber
- Last Name: input#lastName
- DOB: input#dateOfBirth
- Submit: button#btnCheckStatus
```

## Step 3: Create Plugin Structure

```bash
# Create new plugin from template
civic-mcp create plugin

? Plugin ID: gov.texas.yourtexasbenefits
? Plugin Name: Texas YourTexasBenefits
? State/Agency: Texas Health and Human Services
? Website: https://yourtexasbenefits.com
? Author Name: Your Name
? Author Email: your.email@example.com

✓ Plugin created at ./plugin-texas-yourtexasbenefits/
```

This generates:

```
plugin-texas-yourtexasbenefits/
├── manifest.json          # Plugin metadata
├── adapter.js             # Main plugin code (or use declarative.json)
├── declarative.json       # Declarative tool definitions (optional)
├── README.md              # Documentation
├── CHANGELOG.md           # Version history
├── LICENSE                # MIT license
├── .gitignore
└── tests/
    ├── selectors.test.js  # Selector validation tests
    └── tools.test.js      # Tool execution tests
```

## Step 4: Define Tools (Option A: Declarative)

For simple form interactions, edit `declarative.json`:

```json
{
  "id": "gov.texas.yourtexasbenefits",
  "name": "Texas YourTexasBenefits",
  "version": "0.1.0",
  "declarative": true,
  
  "tools": [
    {
      "name": "check_application_status",
      "description": "Check the status of a pending SNAP, TANF, or Medicaid application in Texas",
      
      "navigation": {
        "url": "https://yourtexasbenefits.com/CaseStatus",
        "waitForSelector": "form#statusForm"
      },
      
      "inputs": {
        "applicationNumber": {
          "selector": "input#applicationNumber",
          "type": "text",
          "required": true,
          "description": "12-digit application number"
        },
        "lastName": {
          "selector": "input#lastName",
          "type": "text",
          "required": true,
          "description": "Last name on application"
        },
        "dateOfBirth": {
          "selector": "input#dateOfBirth",
          "type": "text",
          "required": true,
          "description": "Date of birth (MM/DD/YYYY)"
        }
      },
      
      "submit": {
        "selector": "button#btnCheckStatus",
        "waitForSelector": ".status-result"
      },
      
      "output": {
        "status": {
          "selector": ".status-result .application-status",
          "type": "text"
        },
        "lastUpdated": {
          "selector": ".status-result .last-updated",
          "type": "text"
        },
        "pendingActions": {
          "selector": ".status-result .pending-items",
          "type": "text"
        }
      }
    },
    
    {
      "name": "check_snap_eligibility",
      "description": "Pre-screen SNAP eligibility for Texas residents",
      
      "navigation": {
        "url": "https://yourtexasbenefits.com/Learn/EligibilityScreener",
        "waitForSelector": "form#eligibilityForm"
      },
      
      "inputs": {
        "householdSize": {
          "selector": "input#householdSize",
          "type": "number",
          "required": true,
          "min": 1,
          "max": 20
        },
        "monthlyIncome": {
          "selector": "input#monthlyIncome",
          "type": "number",
          "required": true,
          "min": 0
        },
        "hasElderlyOrDisabled": {
          "selector": "input#hasElderlyOrDisabled",
          "type": "checkbox"
        }
      },
      
      "submit": {
        "selector": "button#btnCheckEligibility",
        "waitForSelector": ".eligibility-result"
      },
      
      "output": {
        "likelyEligible": {
          "selector": ".eligibility-result .eligible",
          "type": "boolean"
        },
        "estimatedBenefit": {
          "selector": ".eligibility-result .benefit-amount",
          "type": "number"
        },
        "reason": {
          "selector": ".eligibility-result .reason",
          "type": "text"
        }
      }
    }
  ],
  
  "permissions": {
    "required": ["read:forms", "write:forms"],
    "optional": ["storage:local"]
  }
}
```

## Step 5: Test Locally

### Link Plugin to Development Extension

```bash
cd plugin-texas-yourtexasbenefits

# Link to local dev extension
civic-mcp link

✓ Plugin linked to development extension
✓ Reload your extension at chrome://extensions
```

### Manual Testing in Browser

1. Navigate to https://yourtexasbenefits.com
2. Open DevTools Console
3. Test tool registration:

```javascript
// Check if tools are registered
console.log(navigator.modelContext.tools.size);

// Find your tools
const tools = Array.from(navigator.modelContext.tools.values())
  .filter(t => t.name.startsWith('gov.texas.yourtexasbenefits'));

console.log('Registered tools:', tools.map(t => t.name));

// Test a tool
const statusTool = tools.find(t => t.name.includes('check_application_status'));
const result = await statusTool.execute({
  applicationNumber: '123456789012',
  lastName: 'Smith',
  dateOfBirth: '01/15/1985'
});

console.log('Result:', result);
```

### Automated Testing

```bash
# Run test suite
civic-mcp test

Running tests for gov.texas.yourtexasbenefits...

  ✓ Plugin manifest is valid
  ✓ All required fields present
  ✓ Selectors are reachable on target site
  ✓ Tool: check_application_status executes successfully
  ✓ Tool: check_snap_eligibility executes successfully
  
  5 passing (2.3s)
```

## Step 6: Write Tests

Create `tests/tools.test.js`:

```javascript
import { test, expect } from '@civic-mcp/testing';

test('check_application_status returns valid result', async ({ plugin, page }) => {
  // Navigate to test page
  await page.goto('https://yourtexasbenefits.com/CaseStatus');
  
  // Execute tool
  const result = await plugin.executeTool('check_application_status', {
    applicationNumber: '123456789012',
    lastName: 'TestUser',
    dateOfBirth: '01/01/2000'
  });
  
  // Verify result structure
  expect(result).toHaveProperty('success');
  expect(result).toHaveProperty('status');
  
  // If successful, verify data types
  if (result.success) {
    expect(typeof result.status).toBe('string');
    expect(result.status).not.toBe('');
  }
});

test('check_snap_eligibility calculates correctly', async ({ plugin, page }) => {
  await page.goto('https://yourtexasbenefits.com/Learn/EligibilityScreener');
  
  const result = await plugin.executeTool('check_snap_eligibility', {
    householdSize: 3,
    monthlyIncome: 2500,
    hasElderlyOrDisabled: false
  });
  
  expect(result.success).toBe(true);
  expect(result).toHaveProperty('likelyEligible');
  expect(typeof result.likelyEligible).toBe('boolean');
  
  if (result.likelyEligible) {
    expect(result.estimatedBenefit).toBeGreaterThan(0);
  }
});

test('handles invalid input gracefully', async ({ plugin }) => {
  const result = await plugin.executeTool('check_application_status', {
    applicationNumber: 'invalid',
    lastName: '',
    dateOfBirth: 'not-a-date'
  });
  
  expect(result.success).toBe(false);
  expect(result).toHaveProperty('error');
  expect(result.error).toContain('invalid');
});
```

## Step 7: Document Your Plugin

Edit `README.md`:

```markdown
# Texas YourTexasBenefits Plugin

WebMCP tools for Texas benefits including SNAP, TANF, and Medicaid.

## Tools

### check_application_status
Check the status of a pending application.

**Input:**
- `applicationNumber` (string): 12-digit application number
- `lastName` (string): Last name on application
- `dateOfBirth` (string): Date of birth (MM/DD/YYYY)

**Output:**
- `status` (string): Current application status
- `lastUpdated` (string): Last update date
- `pendingActions` (string): Required actions

### check_snap_eligibility
Pre-screen SNAP eligibility.

**Input:**
- `householdSize` (number): Number of people in household
- `monthlyIncome` (number): Total monthly income
- `hasElderlyOrDisabled` (boolean): Household includes elderly/disabled

**Output:**
- `likelyEligible` (boolean): Eligibility status
- `estimatedBenefit` (number): Estimated monthly benefit
- `reason` (string): Explanation

## Testing

Tested on YourTexasBenefits as of February 2026.

## Support

Report issues: https://github.com/civic-mcp/plugin-texas-yourtexasbenefits/issues
```

## Step 8: Validate Plugin

Run comprehensive validation:

```bash
civic-mcp validate

Validating plugin: gov.texas.yourtexasbenefits

✓ Manifest validation
  ✓ All required fields present
  ✓ Version follows semver
  ✓ Permissions are valid
  
✓ Security scan
  ✓ No eval() usage
  ✓ No arbitrary fetch()
  ✓ No direct cookie access
  ✓ File size under 500KB
  
✓ Code quality
  ✓ ESLint passed
  ✓ No console.log statements
  ✓ Error handling present
  
✓ Documentation
  ✓ README.md exists and complete
  ✓ All tools documented
  ✓ Examples provided
  
✓ Tests
  ✓ Test coverage: 85%
  ✓ All tests passing
  
Plugin validation successful! Ready to publish.
```

## Step 9: Submit to Registry

### First-time Setup

```bash
# Authenticate with GitHub
civic-mcp login

? GitHub username: yourusername
? Personal access token: ghp_***

✓ Authenticated as yourusername
```

### Publish Plugin

```bash
civic-mcp publish

Publishing plugin: gov.texas.yourtexasbenefits v0.1.0

? Plugin category: State Benefits Programs
? Tags (comma-separated): Texas, SNAP, TANF, Medicaid
? This is my first plugin submission (y/n): y

✓ Plugin packaged
✓ Automated checks passed
✓ Creating pull request to plugin-registry...

Pull request created: https://github.com/civic-mcp/plugin-registry/pull/123

Your plugin has been submitted for review!

Community plugins: Auto-approved after automated checks (1-2 hours)
Verified status: Requires maintainer review (1-2 weeks)

Track your submission: https://civic-mcp.dev/plugins/gov.texas.yourtexasbenefits
```

## Step 10: Community Review Process

### For Community Plugins (Automatic)

Your PR is auto-merged if all checks pass:

1. ✅ Automated security scan
2. ✅ Manifest validation
3. ✅ Tests passing
4. ✅ Size limits met
5. ✅ License check

**Timeline:** 1-2 hours

### For Verified Status (Manual Review)

Request verification by commenting on your PR:

```
@civic-mcp/reviewers I would like verified status for this plugin.

Justification:
- Official partnership with Texas HHS
- Production use at [organization name]
- Security audit completed
- Active maintenance commitment
```

Reviewers will:

1. **Code Review**
   - Security audit
   - Best practices check
   - Performance review

2. **Functional Testing**
   - Manual test on live site
   - Edge case validation
   - Accessibility check

3. **Documentation Review**
   - Completeness
   - Accuracy
   - User-friendliness

**Timeline:** 1-2 weeks

## Step 11: Maintain Your Plugin

### Monitor Issues

```bash
# Subscribe to notifications
civic-mcp watch gov.texas.yourtexasbenefits

✓ Watching plugin for:
  - New issues
  - Site changes detected
  - User reports
  - Update requests
```

### Release Updates

When Texas updates their website:

```bash
# Update selectors in declarative.json
# Bump version in manifest.json
{
  "version": "0.2.0"  // was 0.1.0
}

# Test changes
civic-mcp test

# Publish update
civic-mcp publish

Publishing update: gov.texas.yourtexasbenefits v0.2.0

? Changelog entry: Updated selectors for new Texas site design (Feb 2026)
? Breaking changes (y/n): n

✓ Update published
✓ Users will be notified of available update
```

### Deprecation

If you can no longer maintain the plugin:

```bash
civic-mcp deprecate gov.texas.yourtexasbenefits

? Reason: No longer actively using this service
? Recommend transfer to another maintainer (y/n): y
? Suggested maintainer: @texashhs-team

✓ Plugin marked as seeking maintainer
✓ Issue created to find new maintainer
```

## Best Practices

### Security

✅ **DO:**
- Use declarative JSON when possible
- Validate all inputs
- Handle errors gracefully
- Use sandboxed APIs only
- Request minimal permissions

❌ **DON'T:**
- Use eval() or Function()
- Make arbitrary fetch() calls
- Access cookies directly
- Store sensitive data
- Include API keys in code

### Performance

✅ **DO:**
- Cache results when appropriate
- Use efficient selectors
- Minimize page navigations
- Add loading indicators
- Set reasonable timeouts

❌ **DON'T:**
- Poll repeatedly without delays
- Load large external resources
- Block the UI unnecessarily
- Ignore rate limits

### User Experience

✅ **DO:**
- Provide clear error messages
- Show progress notifications
- Document prerequisites (login, etc.)
- Test with real data
- Support accessibility features

❌ **DON'T:**
- Assume successful execution
- Use technical jargon in errors
- Skip user confirmations
- Hide failures silently

### Maintenance

✅ **DO:**
- Monitor site changes
- Respond to issues promptly
- Keep documentation updated
- Follow semantic versioning
- Communicate breaking changes

❌ **DON'T:**
- Let plugin break silently
- Ignore user reports
- Make breaking changes in patches
- Abandon without notice

## Getting Help

- **Discord**: https://discord.gg/civic-mcp
- **Forum**: https://community.civic-mcp.dev
- **Docs**: https://docs.civic-mcp.dev
- **Examples**: https://github.com/civic-mcp/example-plugins

## Recognition

Top contributors receive:

- ⭐ Verified contributor badge
- 📊 Profile on civic-mcp.dev
- 🎁 Swag from civic tech partners
- 🎤 Speaking opportunities at conferences
- 💼 Job opportunities in civic tech

---

**Welcome to the community! Together we're making government services more accessible. 🚀**
