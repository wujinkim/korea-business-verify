# korea-business-verify

A **MCP server** for verifying Korean businesses — gives AI agents tools for business-registration verification, open/closed status, tax type, and tax-invoice issuance eligibility. Built on the Korean NTS (National Tax Service) Public Data Portal API.

> ⚠️ **Disclaimer**: Results are **reference-only**, based on NTS public data, and are not tax advice. For legally binding proof, refer to documents issued by Hometax.

## 5 Tools
| Tool | Description |
|---|---|
| `verify_business` | Verify business registration (matches number · representative name · opening date) |
| `check_business_status` | Open/closed status, tax type, closure date (highest call frequency) |
| `batch_check_status` | Up to 100 businesses **batch status** (expense processing / settlement) |
| `check_invoice_eligibility` | Tax-invoice issuance eligibility **verdict + basis** (exempt/closed, etc.) |
| `explain_kr_tax_type` | Practical meaning of tax types (general/simplified/exempt/non-taxable) |

## Quick Start — DEMO (no service key)

```bash
npm install
npm run build
DEMO_MODE=1 node dist/index.js   # experience all 5 tools with virtual numbers
```

**DEMO virtual business numbers** (valid checksum, not real):
| Number | Status | Tax type |
|---|---|---|
| `1111111119` | Active | General → tax invoice OK |
| `2222222227` | Active | Exempt → cash invoice |
| `3333333336` | Closed | → unavailable |

## Live mode (real NTS API)

1. Get a service key: **[docs/get-api-key.md](docs/get-api-key.md)** (apply for verification **and** status services **separately**)
2. `.env`:
   ```
   NTS_SERVICE_KEY=your_service_key
   ```
3. Run: `node dist/index.js` (auto live mode when key is present)

## Claude Desktop / Cursor

`claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "korea-business-verify": {
      "command": "node",
      "args": ["/abs/path/korea-business-verify/dist/index.js"],
      "env": { "NTS_SERVICE_KEY": "your_key" }
    }
  }
}
```

## Privacy (no-storage principle)

- **The service key lives only in your local `.env`**. This server never stores or logs it; it is used solely for NTS API authentication.
- **Verification inputs (representative name, etc.) are discarded immediately** after the request. They are sent to the NTS API for verification, but on response receipt they are never retained in any log, cache, or storage.
- Only the business number and status result (24h TTL) are cached. Verification is **never cached**.
- Business numbers are pre-filtered by **checksum validation** before any API call.

## Reliability

- Auto-retry (exponential backoff, 3 attempts) on 5xx/timeout/network. Auth/format errors return clear codes immediately.
- Every verdict includes a `basis` (reasoning) field.

## Development

```bash
npm run build     # tsc
npm test          # vitest (96% coverage)
npm run lint      # eslint
```

## License
MIT
