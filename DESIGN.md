# Government Agent Marketplace (Civic-MCP)

## Vision

An open source platform enabling crowdsourced WebMCP adapters for government websites, allowing any developer to contribute site integrations and any user to install verified plugins for their state/local government services.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Base Extension (Core Framework)                            │
│  - Plugin loader and runtime                                │
│  - Security sandbox                                         │
│  - Marketplace UI                                           │
│  - Update manager                                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ├─────────────────────────────────────────┐
                   │                                         │
       ┌───────────▼──────────┐              ┌──────────────▼─────────┐
       │  Plugin Marketplace   │              │  GitHub Registry       │
       │  (discovery UI)       │◄─────────────┤  (source of truth)     │
       └───────────┬───────────┘              └────────────────────────┘
                   │                                         │
                   │                                         │
    ┌──────────────▼───────────────┐                       │
    │  Individual Site Adapters    │◄──────────────────────┘
    │  (plugins)                   │
    └──────────────┬───────────────┘
                   │
         ┌─────────┴──────────┐
         │                    │
    ┌────▼─────┐      ┌──────▼────────┐
    │ Verified │      │ Community     │
    │ Official │      │ Contributed   │
    └──────────┘      └───────────────┘
```

## Core Components

### 1. Base Extension (Civic-MCP Core)

**Responsibilities:**
- Load and manage site adapter plugins
- Provide security sandbox for plugin execution
- Marketplace UI for browsing/installing/managing plugins
- Update mechanism for plugins and core
- Telemetry and error reporting (opt-in)

**Key Files:**
```
civic-mcp-core/
├── manifest.json          # Base extension manifest
├── core/
│   ├── plugin-loader.js   # Dynamic plugin loading
│   ├── sandbox.js         # Security isolation
│   ├── registry.js        # Plugin registry client
│   └── updater.js         # Auto-update system
├── marketplace/
│   ├── browse.html        # Plugin discovery UI
│   ├── browse.js          # Marketplace logic
│   └── install.js         # Installation flow
└── background.js          # Service worker
```

### 2. Site Adapter Plugins

**Plugin Structure:**
```
plugin-colorado-peak/
├── manifest.json          # Plugin metadata
├── adapter.js             # WebMCP tool definitions
├── selectors.json         # DOM selectors config
├── icon.png               # Plugin icon
├── README.md              # Documentation
└── tests/
    └── test-suite.js      # Automated tests
```

**Plugin Manifest Example:**
```json
{
  "id": "gov.colorado.peak",
  "name": "Colorado PEAK Benefits",
  "version": "1.2.0",
  "author": "Example Civic Tech Org",
  "authorUrl": "https://example.org",
  "description": "WebMCP tools for Colorado SNAP, Medicaid, and Colorado Works applications",
  "homepage": "https://peak.my.site.com",
  "repository": "https://github.com/civic-mcp/plugin-colorado-peak",
  "license": "MIT",
  "domains": [
    "peak.my.site.com",
    "colorado.gov/peak"
  ],
  "tools": [
    {
      "name": "check_application_status",
      "category": "application",
      "security_level": "read_only"
    },
    {
      "name": "start_snap_application",
      "category": "application",
      "security_level": "write"
    }
  ],
  "permissions": [
    "activeTab",
    "storage"
  ],
  "verified": true,
  "officialPartner": "Colorado Department of Human Services",
  "statistics": {
    "installs": 1243,
    "rating": 4.8,
    "lastUpdated": "2026-02-15"
  }
}
```

### 3. Plugin Registry (GitHub-based)

**Central Registry Structure:**
```
github.com/civic-mcp/plugin-registry/
├── plugins/
│   ├── gov.colorado.peak/
│   │   ├── manifest.json
│   │   ├── verification.json
│   │   └── releases/
│   │       ├── 1.0.0.zip
│   │       ├── 1.1.0.zip
│   │       └── 1.2.0.zip
│   ├── gov.california.calwin/
│   ├── gov.michigan.bridges/
│   └── gov.federal.ssa/
├── registry.json          # Master plugin list
├── verified.json          # Verified publishers
└── CONTRIBUTING.md        # Contribution guide
```

**registry.json:**
```json
{
  "version": "1.0",
  "updated": "2026-02-16T10:00:00Z",
  "plugins": [
    {
      "id": "gov.colorado.peak",
      "name": "Colorado PEAK Benefits",
      "latestVersion": "1.2.0",
      "category": "state_benefits",
      "tags": ["SNAP", "Medicaid", "Colorado"],
      "verified": true,
      "downloads": "https://github.com/civic-mcp/plugin-registry/releases/download/gov.colorado.peak-1.2.0/plugin.zip"
    }
  ],
  "categories": [
    {
      "id": "state_benefits",
      "name": "State Benefits Programs",
      "count": 45
    },
    {
      "id": "federal",
      "name": "Federal Services",
      "count": 12
    }
  ]
}
```

### 4. Marketplace UI

**User Flow:**
1. Open extension popup
2. Click "Browse Plugins"
3. See categorized list of available adapters
4. Search by state/program/agency
5. View plugin details (tools, permissions, reviews)
6. Click "Install"
7. Enable/disable specific tools
8. Manage installed plugins

**Marketplace Features:**
- Search and filter by location/program
- Sort by popularity, rating, last updated
- View plugin permissions and required tools
- One-click installation
- Automatic updates (opt-in)
- Usage statistics (opt-in anonymous)
- Community ratings and reviews

## Plugin Development Workflow

### Option 1: Declarative Plugins (Simple Sites)

For basic form interactions, contributors can create **JSON-only plugins**:

```json
{
  "id": "gov.example.benefits",
  "declarative": true,
  "tools": [
    {
      "name": "check_eligibility",
      "description": "Check eligibility for state benefits",
      "navigation": {
        "url": "https://benefits.example.gov/check",
        "waitForSelector": "form#eligibility"
      },
      "inputs": {
        "householdSize": {
          "selector": "input[name='household_size']",
          "type": "number"
        },
        "monthlyIncome": {
          "selector": "input[name='monthly_income']",
          "type": "number"
        }
      },
      "submit": {
        "selector": "button[type='submit']"
      },
      "output": {
        "eligible": {
          "selector": ".result .eligible",
          "type": "boolean"
        },
        "message": {
          "selector": ".result .message",
          "type": "text"
        }
      }
    }
  ]
}
```

**No JavaScript required!** The core engine interprets this and generates WebMCP tools automatically.

### Option 2: JavaScript Plugins (Complex Sites)

For advanced interactions, contributors write JavaScript:

```javascript
// plugin-colorado-peak/adapter.js
export default {
  id: 'gov.colorado.peak',
  
  async init(context) {
    // Called when plugin loads
    console.log('Colorado PEAK adapter initialized');
  },
  
  tools: [
    {
      name: 'start_snap_application',
      description: 'Begin new SNAP application',
      inputSchema: { /* ... */ },
      
      async execute(params, context) {
        // Access to safe API only
        const { page, storage, notify } = context;
        
        // Navigate
        await page.navigate('https://peak.my.site.com/peak/s/afb-welcome');
        
        // Fill form
        await page.fillField('input[name="firstName"]', params.firstName);
        await page.fillField('input[name="lastName"]', params.lastName);
        
        // Submit
        await page.click('button[type="submit"]');
        
        // Extract result
        const appId = await page.getText('.confirmation-number');
        
        return {
          success: true,
          applicationId: appId
        };
      }
    }
  ]
};
```

### Option 3: Hybrid Approach

**Recommended for most plugins:**
- Use declarative JSON for simple interactions
- Add JavaScript only where needed
- Core validates and sandboxes both

## Security Model

### Trust Levels

1. **Official** (highest trust)
   - Developed by government agencies
   - Code reviewed by security team
   - Digitally signed
   - Auto-approved for sensitive operations
   - Examples: IRS, SSA, state DHHS

2. **Verified** (high trust)
   - Developed by known civic tech organizations
   - Full code review completed
   - Active maintenance commitment
   - Examples: established civic tech organizations (none enrolled yet)

3. **Community** (user discretion)
   - Open source, anyone can contribute
   - Automated security scanning
   - Peer review via GitHub
   - User ratings and reports
   - Examples: Individual developers

### Security Features

**Sandbox Environment:**
```javascript
// Plugins get access to safe APIs only
const context = {
  // Page interaction (controlled)
  page: {
    navigate: (url) => { /* whitelist check */ },
    fillField: (selector, value) => { /* sanitize */ },
    click: (selector) => { /* rate limit */ },
    getText: (selector) => { /* return text */ }
  },
  
  // Storage (scoped to plugin)
  storage: {
    get: (key) => { /* plugin-specific namespace */ },
    set: (key, value) => { /* size limits */ }
  },
  
  // User notifications
  notify: {
    info: (msg) => { /* show notification */ },
    warn: (msg) => { /* show warning */ },
    error: (msg) => { /* show error */ }
  },
  
  // NO access to:
  // - navigator.modelContext directly
  // - chrome.* APIs
  // - fetch() to arbitrary URLs
  // - eval() or Function()
  // - localStorage
};
```

**Permission System:**
```json
{
  "permissions": {
    "required": [
      "read:forms",      // Read form data
      "write:forms"      // Fill form fields
    ],
    "optional": [
      "storage:local",   // Local storage access
      "notifications"    // Show notifications
    ]
  }
}
```

Users see permissions before installing and can revoke them.

**Code Signing:**
```bash
# Verified plugins are signed
{
  "signature": "SHA256:abc123...",
  "signer": "Example Civic Tech Org",
  "signedAt": "2026-02-15T10:00:00Z",
  "verified": true
}
```

### Content Security Policy

```javascript
// Plugins cannot:
// - Make arbitrary network requests
// - Access cookies directly
// - Execute inline eval()
// - Load external scripts
// - Access other plugins' data
```

## Contribution Process

### Step 1: Create Plugin

```bash
# Use CLI tool to scaffold
npm install -g @civic-mcp/cli

civic-mcp create plugin
? Plugin ID: gov.newstate.portal
? Name: New State Benefits Portal
? State/Agency: New State Department of Services
? Website: https://benefits.newstate.gov

# Generates template:
plugin-newstate-portal/
├── manifest.json
├── adapter.js
├── selectors.json
└── README.md
```

### Step 2: Develop Locally

```bash
cd plugin-newstate-portal

# Link to development extension
civic-mcp link

# Test in Chrome
civic-mcp test --browser chrome
```

### Step 3: Automated Testing

```javascript
// tests/test-suite.js
describe('New State Portal Adapter', () => {
  it('should check eligibility correctly', async () => {
    const result = await testTool('check_eligibility', {
      householdSize: 3,
      monthlyIncome: 2500
    });
    
    expect(result.success).toBe(true);
    expect(result.eligible).toBeDefined();
  });
  
  it('should handle errors gracefully', async () => {
    const result = await testTool('check_eligibility', {
      householdSize: -1  // invalid
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

### Step 4: Submit for Review

```bash
# Run automated checks
civic-mcp validate

# Submit to registry
civic-mcp publish

# Opens PR to plugin-registry repo
```

### Step 5: Community Review

**Automated Checks:**
- ✅ Manifest validation
- ✅ Security scan (no eval, fetch, etc.)
- ✅ Permission audit
- ✅ Size limits (<500KB)
- ✅ Code style (ESLint)
- ✅ Test coverage (>80%)

**Human Review (for verified status):**
- Code walkthrough by maintainer
- Manual testing on target site
- Documentation completeness
- Accessibility check
- Performance profile

**Approval:**
- Community plugins: Auto-approved after automated checks
- Verified plugins: Requires maintainer approval
- Official plugins: Requires government agency signature

### Step 6: Publication

Once approved:
- Plugin published to registry
- Appears in marketplace for all users
- Automatic update notifications
- Usage statistics tracking begins

## User Experience

### First-Time Setup

1. **Install Base Extension**
   - One-time from Chrome Web Store
   - "Civic-MCP - AI Tools for Government Services"

2. **Initial Configuration**
   - Select your state/location
   - Choose relevant programs (SNAP, Medicaid, etc.)
   - Get plugin recommendations

3. **Browse Marketplace**
   - See suggested plugins for your location
   - View popular plugins nationwide
   - Search by agency or program name

### Installing a Plugin

**Marketplace Card:**
```
┌─────────────────────────────────────────┐
│  📍 Colorado PEAK Benefits              │
│  ⭐⭐⭐⭐⭐ 4.8 (1,243 installs)          │
│                                         │
│  SNAP, Medicaid, Colorado Works         │
│  By: Example Org ✓ Verified                │
│                                         │
│  Tools: 5 | Updated: 2 days ago         │
│                                         │
│  [Install] [Details]                    │
└─────────────────────────────────────────┘
```

**Click "Install" →**
```
┌─────────────────────────────────────────┐
│  Permission Request                     │
│                                         │
│  Colorado PEAK Benefits needs:          │
│  ✓ Read form data on peak.my.site.com  │
│  ✓ Fill form fields                    │
│  ✓ Local storage for preferences       │
│                                         │
│  [Allow] [Review Code] [Cancel]         │
└─────────────────────────────────────────┘
```

**After installation:**
```
┌─────────────────────────────────────────┐
│  ✓ Colorado PEAK Benefits               │
│  Installed successfully!                │
│                                         │
│  5 new tools available:                 │
│  • check_application_status             │
│  • start_snap_application               │
│  • check_program_eligibility            │
│  • upload_documents                     │
│  • get_peak_page_info                   │
│                                         │
│  Visit peak.my.site.com to use          │
└─────────────────────────────────────────┘
```

### Managing Installed Plugins

**Extension Popup:**
```
┌─────────────────────────────────────────┐
│  Civic-MCP                            │
│  ─────────────────────────────────      │
│  Installed Plugins (3)                  │
│                                         │
│  🟢 Colorado PEAK Benefits              │
│     5 tools • Updated 2d ago            │
│     [Disable] [Configure] [Remove]      │
│                                         │
│  🟢 California GetCalFresh              │
│     3 tools • Updated 1w ago            │
│     [Disable] [Configure] [Remove]      │
│                                         │
│  🔴 Michigan MI Bridges (disabled)      │
│     4 tools • Updated 1mo ago           │
│     [Enable] [Configure] [Remove]       │
│                                         │
│  [+ Browse Marketplace]                 │
└─────────────────────────────────────────┘
```

**Per-Plugin Settings:**
```
┌─────────────────────────────────────────┐
│  Colorado PEAK Benefits Settings        │
│  ─────────────────────────────────      │
│  Tool Permissions                       │
│                                         │
│  ☑ check_application_status             │
│  ☑ start_snap_application               │
│  ☑ check_program_eligibility            │
│  ☐ upload_documents (disabled)          │
│  ☑ get_peak_page_info                   │
│                                         │
│  Preferences                            │
│  ☑ Auto-update plugin                   │
│  ☑ Send anonymous usage stats           │
│  ☐ Show debug information               │
│                                         │
│  [Save] [Reset to Defaults]             │
└─────────────────────────────────────────┘
```

## Ecosystem Growth

### Launch Strategy

**Phase 1: Foundation (Months 1-3)**
- Build core extension with plugin loader
- Create 5 official plugins for high-volume states
- Launch MVP marketplace
- Open source all components

**Phase 2: Community Building (Months 4-6)**
- Developer documentation and examples
- Contribution guidelines and templates
- CLI tooling for plugin development
- First community contributions

**Phase 3: Scaling (Months 7-12)**
- 25+ state benefits portals covered
- Federal agency plugins (SSA, VA, IRS)
- Plugin certification program
- Partner with civic tech organizations

**Phase 4: Ecosystem (Year 2+)**
- 100+ plugins across all 50 states
- International government services
- Local government (DMV, permits, licenses)
- Premium support tier for agencies

### Target Coverage

**Year 1 Goals:**
```
State Benefits Portals:        25 states (50%)
Federal Services:              5 agencies
Local Government:              10 major cities
Total Plugins:                 40+
Community Contributors:        50+
Total Installs:                10,000+
```

**Year 3 Goals:**
```
State Benefits Portals:        50 states (100%)
Federal Services:              15 agencies
Local Government:              100 cities
International:                 5 countries
Total Plugins:                 200+
Community Contributors:        500+
Total Installs:                100,000+
```

## Monetization (Optional)

### Free Forever Model

Core mission: **Enable AI-assisted access to government services for all**

All plugins remain free and open source.

### Optional Revenue Streams

1. **Enterprise Support**
   - Priority plugin development
   - Custom integrations
   - Training and onboarding
   - SLA guarantees
   - Price: $50k-200k/year per agency

2. **Certification Services**
   - Fast-track verification for agencies
   - Security audit and penetration testing
   - Compliance certification (Section 508, FedRAMP)
   - Price: $25k-75k per plugin

3. **Grants and Partnerships**
   - Government innovation grants
   - Civic tech foundation funding
   - Corporate sponsorship
   - Research partnerships

4. **Premium Features (Opt-in)**
   - Advanced analytics dashboard
   - Multi-user team collaboration
   - API access for integrations
   - White-label deployments
   - Price: $10-50/month for pro users

## Technical Challenges

### Challenge 1: Plugin Conflicts

**Problem:** Two plugins try to register tools with same name

**Solution:**
```javascript
// Namespace tools by plugin ID
const toolId = `${pluginId}.${toolName}`;
// Result: "gov.colorado.peak.check_eligibility"
```

### Challenge 2: Version Management

**Problem:** User has old plugin, site has changed

**Solution:**
- Semantic versioning (major.minor.patch)
- Breaking changes = major version bump
- Deprecation warnings before breaking changes
- Automatic update notifications
- Rollback capability

### Challenge 3: Site Changes

**Problem:** Government site updates HTML, plugin breaks

**Solution:**
- Automated testing against live sites
- Monitor for breaking changes
- Alert plugin authors immediately
- Community can submit quick fixes
- Fallback to "site changed" error message

### Challenge 4: Cross-Plugin Coordination

**Problem:** User wants to use data from Colorado plugin in California plugin

**Solution:**
- Shared storage API (opt-in, explicit permissions)
- Standard data formats (JSON schemas)
- Inter-plugin messaging (secure)
- User consent required

### Challenge 5: Malicious Plugins

**Problem:** Bad actor publishes plugin that steals data

**Solution:**
- Sandbox prevents access to sensitive APIs
- Code review for verified plugins
- User reports and rating system
- Automated security scanning
- Immediate takedown capability
- Signed plugins only from verified authors

## Governance Model

### Open Source Foundation

**Structure:**
- 501(c)(3) nonprofit foundation
- Multi-stakeholder board
  - Government representatives (3 seats)
  - Civic tech organizations (3 seats)
  - Community maintainers (3 seats)
  - User advocates (2 seats)

**Responsibilities:**
- Maintain plugin registry
- Review and approve verified plugins
- Security incident response
- Community standards and enforcement
- Grant distribution

### Community Roles

**Maintainers:**
- Review plugin submissions
- Merge code contributions
- Security response
- Elected by community

**Contributors:**
- Submit plugins
- Fix bugs
- Improve documentation
- Anyone can contribute

**Users:**
- Install and use plugins
- Rate and review
- Report issues
- Vote on feature priorities

## Success Metrics

### Technical Metrics
- Plugin load time <100ms
- Tool execution time <2s average
- Crash rate <0.1%
- Security incidents: 0

### Adoption Metrics
- Chrome Web Store installs
- Active monthly users
- Plugins installed per user
- Tool execution frequency

### Community Metrics
- GitHub stars/forks
- Plugin submissions per month
- Contributor growth rate
- Plugin coverage by state

### Impact Metrics
- Applications completed via tools
- Time saved (user surveys)
- Error rate reduction
- User satisfaction (NPS)

## Next Steps to Build

1. **MVP Core Extension** (4-6 weeks)
   - Plugin loader framework
   - Basic marketplace UI
   - 2-3 seed plugins
   - GitHub registry setup

2. **Developer Tools** (2-3 weeks)
   - CLI for scaffolding
   - Testing framework
   - Documentation site
   - Contribution guide

3. **Security Infrastructure** (3-4 weeks)
   - Sandbox implementation
   - Code signing system
   - Automated security scans
   - Review process

4. **Community Launch** (2-3 weeks)
   - Website and branding
   - Developer outreach
   - First contributor recruitment
   - Beta user program

---

This creates a **sustainable, community-driven ecosystem** for government digital service automation. The key insight: **make it as easy to contribute a government site adapter as it is to publish an npm package.**
