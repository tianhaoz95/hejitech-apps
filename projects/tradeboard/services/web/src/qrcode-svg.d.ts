declare module "qrcode-svg" {
  export default class QRCode {
    constructor(opts: { content: string; padding?: number; width?: number; height?: number; ecl?: "L" | "M" | "Q" | "H"; join?: boolean; container?: string });
    svg(): string;
  }
}
