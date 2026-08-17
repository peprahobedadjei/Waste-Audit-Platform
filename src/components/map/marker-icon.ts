import L from "leaflet";

/*
  Leaflet's default marker is a PNG referenced by relative path, which breaks
  under every bundler. Rather than patch the asset paths, markers here are
  inline HTML - no image files, and they pick up the brand colour from the CSS
  variables, so a rebrand retints the map too.
*/

export type PinTone = "brand" | "success" | "danger" | "pending" | "muted";

const TONE_VAR: Record<PinTone, string> = {
  brand: "var(--brand-primary)",
  success: "var(--success)",
  danger: "var(--danger)",
  pending: "var(--pending)",
  muted: "var(--text-muted)",
};

export function pinIcon(tone: PinTone = "brand", label?: string): L.DivIcon {
  const colour = TONE_VAR[tone];

  return L.divIcon({
    className: "wa-pin",
    html: `
      <div style="
        width:26px;height:26px;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        background:${colour};
        border:2px solid #fff;
        box-shadow:0 1px 4px rgba(0,0,0,.4);
        display:flex;align-items:center;justify-content:center;
      ">
        <span style="
          transform:rotate(45deg);
          color:#fff;font-size:11px;font-weight:700;
          font-family:var(--font-sora),system-ui,sans-serif;
        ">${label ?? ""}</span>
      </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26],
  });
}
