# BOA Architecture: Core, Dashboard, Network

BOA is a daemon-first trust gateway, not a website-first encryption toy.

## Desired operating model

1. **BOA Core** lives on the user's device as the active translator and gate.
   It wraps outbound BOA-routed payloads, unwraps trusted inbound BOA envelopes,
   applies policy, stores local identity, and keeps running when the dashboard is closed.
2. **BOA Dashboard** is the control surface. It handles account creation, licensing,
   pairing, plan upgrades, health checks, status, and user toggles. It does not need
   to be open for BOA Core to keep operating.
3. **BOA Network** is the protocol connecting trusted BOA instances. It uses signed,
   opaque envelopes so intercepted BOA-routed messages, files, and tasks are not
   meaningful to an unauthorized observer.

## Translator framing

BOA should become the default trust gateway for every communication channel it is
authorized to manage. On current operating systems, full-device interception requires
platform-specific integration:

- Android: VPNService, accessibility, or other OS-supported mediation.
- Windows: Windows Filtering Platform or approved proxy/firewall integration.
- Linux: firewall, routing, proxy, or service-manager integration.
- macOS: Network Extension or approved proxy integration.

The MVP therefore protects BOA-aware traffic and local proxy/gate traffic today, while
leaving privileged VPN/firewall/kernel adapters as explicit future work.

## License and clone model

The user buys a license that can clone BOA Core instances to approved devices. A clone
is not just a downloaded program; it is a licensed BOA identity with:

- account identity,
- device identity,
- password-derived language identity,
- local transport secret,
- pairing/handshake proof,
- policy settings.

Devices with the same account/license can discover each other through the dashboard or
cloud relay, but trusted communication still requires a matching language/secret or an
accepted handshake.

## Opaque-envelope claim

The concrete testable claim is: intercepted BOA-routed data should look like gibberish.

In this MVP, BOA envelopes are signed and payload bodies are sealed using the local
transport secret. The dashboard displays safe previews and event counts, but the gate
never executes received network data. Raw inbound signals can be allowed, warned, or
rejected depending on policy.

## Phase lattice and per-device billing

BOA can safely demonstrate the geometric phase idea as a simulation layer: key-derived coordinate transforms make correct-language recovery precise and wrong-language recovery garbage, while lattice snapshots estimate dedupe-style reuse and compression pressure. This is useful as a dashboard proof-of-concept and onboarding demo. It must remain labeled as simulation until tied to real storage, OS, or filesystem adapters.

Billing should follow the product boundary: daemon security is free, while connected-device features are paid. Per-device pricing matches the license-clone model better than charging for the base program, because users are paying for extra trusted BOA instances, routes, relay, casting, and resource sharing.

## 3D coordinate phase stack

BOA now includes a concrete MVP phase stack: data is stored at a deterministic `(x, y, z)` coordinate and an equation-depth layer. To read it, BOA isolates the coordinate, follows the exact equation path for that layer depth, and brings the payload forward through the password-derived language. Unified-device efficiency and pricing are modeled from connected devices, stack reuse, and entry depth; actual hardware gains still require real adapters and workload measurement.

## Aletheia coexistence layer

BOA can coexist with `AeonUnifiedAletheia_FullFeatured` and `MyAletheia222069` without turning the BOA repository into three competing application roots. The safe product split is:

1. **BOA Core** remains the daemon/local gate that wraps, unwraps, routes, pairs, and reports signal status.
2. **BOA Dashboard** remains the plain website/control panel for accounts, pairing, Stripe, device status, and backend visibility.
3. **Aletheia** becomes the closure-first reverse-solve intelligence layer that can plan, reason, and materialize from a target closure state.

The current bridge lives in `integrations/aletheia/` and `src/aletheia_bridge.js`. It exposes Aletheia metadata and the Omega Closure Reverse Operator through `GET /aletheia`, `GET /api/aletheia/status`, and `POST /api/aletheia/reverse-solve`. This keeps BOA deployable as a pure Node.js app while still making the other projects visible and usable through the dashboard.

### Omega Closure Reverse Operator in BOA terms

The bridge implements the product-safe version of:

`R_Ω^-1(X_f) = [X_f => Ω => μ => (α_m/s, α_s/m) => (c_m/s, c_s/m) => (0≠0) => η_t^4 => V_λ => X_0]`

Plainly: start from the desired final product state, reverse it into the closure requirement, isolate the μ-field mismatch, split the alpha propagation modes, determine whether cancellation is null-light or standing-wave/matter, then produce the recoverable origin path. BOA uses that as a planning/translation layer, not as a claim that the website directly controls operating-system physics.


### Aletheia as BOA's cybersecurity builder

Aletheia now builds on BOA by converting a desired final security state into a concrete implementation plan. The bridge returns:

- BOA capability layers that are active today,
- future privileged adapter layers that require OS permission,
- a threat model,
- safeguards against unsafe execution and secret leakage,
- build phases from MVP membrane to zero-trust mesh,
- acceptance tests that prove the product claim.

This makes Aletheia the planning/materialization intelligence and BOA the enforcement substrate. The honest closure state is not “BOA magically controls all traffic”; it is “BOA protects all channels it is authorized to route today, and Aletheia identifies every missing adapter needed for broader coverage.”


## Full unification boundary

The unified repo now contains local Aletheia modules inside `integrations/aletheia/modules/`. This is a true source-level unification boundary, not only remote links. The root BOA app still owns AWS startup and no-code dashboard delivery, while Aletheia source remains in its own package/runtime boundary so the TypeScript/Vite/pnpm app cannot break BOA's pure Node deployment.

`src/aletheia_bridge.js` reads `integrations/aletheia/unified-workspace.json`, checks that each module exists locally, reports file counts/package scripts, and produces a full unification plan through `POST /api/aletheia/unify`. The next deeper step is to build the Aeon frontend as a static artifact or run it as a sidecar service behind the same BOA domain.
