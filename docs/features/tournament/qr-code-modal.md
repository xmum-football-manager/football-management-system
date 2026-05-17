# qr-code-modal

## What & Why

Participants share the public tournament URL at the venue — a QR code lets anyone scan and open the live view without typing. The `qrcode` npm package (types already installed) generates a data URL from the current page URL which is rendered in a modal.

## Behaviour

- "QR" button appears in the public tournament page header next to the WhatsApp share button
- Clicking opens a centered modal with the QR code and the URL text below it
- Clicking outside the modal or pressing Escape closes it
- QR code is generated client-side from `window.location.href`

## Component

`components/QrModal.tsx` — self-contained client component that accepts an `onClose` callback and generates the QR on mount.

## Dependencies

- `qrcode` npm package (install with pnpm)
- `@types/qrcode` already installed
