import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { useI18n } from "../lib/i18n";
import { swalError, swalToast } from "../lib/swal";
import { isXbloomSerial } from "../lib/validate";

// xBloom serials carry letters, so only the alphanumeric 1D formats are scanned —
// the digits-only product UPC/EAN on the same label is naturally ignored.
const FORMATS = ["code_128", "code_39", "code_93"];
const cleanSerial = (raw: string) => raw.replace(/^SN[:\s]*/i, "").trim().toUpperCase();

// ── Native BarcodeDetector (Chrome/Android) — fast + hardware-accelerated ──
type DetectedBarcode = { rawValue: string; boundingBox: { x: number; y: number; width: number; height: number } };
interface BarcodeDetectorLike {
  detect(src: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
function detectorCtor(): BarcodeDetectorCtor | null {
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null;
}

// Region of interest: only a barcode whose CENTRE sits in this central band of
// the frame is read, so other barcodes elsewhere on the label (product SKU, etc.)
// are ignored even if they share the SN's symbology. Robust under object-cover —
// the frame centre always maps to the screen centre. Generous, so the visual aim
// box sits well inside it (anything in the box is guaranteed inside the ROI).
const ROI = { x0: 0.08, x1: 0.92, y0: 0.28, y1: 0.72 };
const centreInRoi = (cx: number, cy: number) => cx >= ROI.x0 && cx <= ROI.x1 && cy >= ROI.y0 && cy <= ROI.y1;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Draw the image rotated by `deg` (downscaled) onto a canvas. */
function rotatedCanvas(img: HTMLImageElement, deg: number): HTMLCanvasElement {
  const max = 2400;
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  const rad = (deg * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(w * cos + h * sin);
  cv.height = Math.ceil(w * sin + h * cos);
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.translate(cv.width / 2, cv.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return cv;
}

/** Photo fallback: decode a still image. Tries native detector first, then ZXing at several angles. */
async function decodeStill(url: string): Promise<string> {
  const img = await loadImage(url);
  const angles = [0, -6, 6, -12, 12, -18, 18, -24, 24, -30, 30, 90, -90];

  const Ctor = detectorCtor();
  if (Ctor) {
    const det = new Ctor({ formats: FORMATS });
    for (const deg of [0, -8, 8, 90, -90]) {
      try {
        const codes = await det.detect(rotatedCanvas(img, deg));
        const hit = codes.find((c) => isXbloomSerial(cleanSerial(c.rawValue))) ?? codes[0];
        if (hit?.rawValue) return hit.rawValue;
      } catch {
        /* fall through to ZXing */
      }
    }
  }

  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import("@zxing/browser"),
    import("@zxing/library"),
  ]);
  const hints = new Map<number, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new BrowserMultiFormatReader(hints);
  for (const deg of angles) {
    try {
      const r = await reader.decodeFromCanvas(rotatedCanvas(img, deg));
      if (r?.getText()) return r.getText();
    } catch {
      /* try next angle */
    }
  }
  throw new Error("not found");
}

/**
 * "Scan SN" button.
 *  - Secure context (localhost / HTTPS): opens a LIVE continuous scanner — the
 *    serial pops the instant the barcode is readable (no shutter, no retakes).
 *  - Plain HTTP (camera blocked): falls back to snapping a photo and decoding it.
 */
export default function ScanSerial({ onResult, className = "" }: { onResult: (sn: string) => void; className?: string }) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);

  function open() {
    if (window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === "function") setLive(true);
    else inputRef.current?.click();
  }

  function accept(sn: string) {
    onResult(sn);
    swalToast("success", `${t("scan.found")}: ${sn}`);
  }

  async function handlePhoto(file: File | null) {
    if (!file) return;
    setBusy(true);
    const url = URL.createObjectURL(file);
    try {
      const sn = cleanSerial(await decodeStill(url));
      if (!sn) throw new Error("empty");
      if (!isXbloomSerial(sn)) {
        swalError(t("scan.failTitle"), t("scan.notSerial"));
        return;
      }
      accept(sn);
    } catch {
      swalError(t("scan.failTitle"), t("scan.failMsg"));
    } finally {
      URL.revokeObjectURL(url);
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className={`flex shrink-0 items-center justify-center gap-1.5 rounded-xl2 border border-line bg-card px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-canvas disabled:opacity-50 ${className}`}
      >
        <Icon name="camera" size={16} />
        {busy ? t("scan.reading") : t("scan.btn")}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
      />
      {live && (
        <LiveScanner
          onSerial={(sn) => {
            setLive(false);
            accept(sn);
          }}
          onClose={() => setLive(false)}
          onUsePhoto={() => {
            setLive(false);
            inputRef.current?.click();
          }}
        />
      )}
    </>
  );
}

function LiveScanner({
  onSerial,
  onClose,
  onUsePhoto,
}: {
  onSerial: (sn: string) => void;
  onClose: () => void;
  onUsePhoto: () => void;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopped = useRef(false);
  const lastSeen = useRef("");
  // Keep the latest onSerial in a ref so the camera effect doesn't tear down and
  // re-acquire getUserMedia when the parent re-creates this callback every render
  // (e.g. Coverage's 1-second countdown), which made the live scanner unusable.
  const onSerialRef = useRef(onSerial);
  onSerialRef.current = onSerial;
  const [error, setError] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [torchOk, setTorchOk] = useState(false);
  const [hint, setHint] = useState("");

  useEffect(() => {
    let raf = 0;
    let zx: { stop: () => void } | null = null;
    let cancelled = false;
    stopped.current = false;
    lastSeen.current = "";

    const stopAll = () => {
      cancelAnimationFrame(raf);
      try {
        zx?.stop();
      } catch {
        /* ignore */
      }
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };

    // Given the DISTINCT valid serials found inside the aim box this frame:
    //  • 0  → nothing to do
    //  • >1 → two different serials in the box at once → ambiguous, refuse to
    //         guess (resets the streak and asks the user to isolate one)
    //  • 1  → accept only after the SAME value is seen twice in a row (kills the
    //         rare single-frame misread → 100% correct)
    const onFrame = (valids: string[]) => {
      if (stopped.current) return;
      const distinct = [...new Set(valids)];
      if (distinct.length === 0) return;
      if (distinct.length > 1) {
        lastSeen.current = "";
        setHint(t("scan.multi"));
        return;
      }
      setHint("");
      const sn = distinct[0];
      if (lastSeen.current === sn) {
        stopped.current = true;
        stopAll();
        onSerialRef.current(sn);
      } else {
        lastSeen.current = sn;
      }
    };

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play().catch(() => {});

        const track = stream.getVideoTracks()[0];
        // Continuous autofocus helps small/close barcodes lock quickly.
        try {
          await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
        } catch {
          /* not supported */
        }
        const caps = track.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
        if (caps?.torch) setTorchOk(true);

        const Ctor = detectorCtor();
        if (Ctor) {
          const det = new Ctor({ formats: FORMATS });
          const loop = async () => {
            if (stopped.current || cancelled) return;
            if (v.readyState >= 2 && v.videoWidth) {
              try {
                const codes = await det.detect(v);
                const valids: string[] = [];
                for (const c of codes) {
                  const sn = cleanSerial(c.rawValue);
                  if (!isXbloomSerial(sn)) continue;
                  const cx = (c.boundingBox.x + c.boundingBox.width / 2) / v.videoWidth;
                  const cy = (c.boundingBox.y + c.boundingBox.height / 2) / v.videoHeight;
                  if (centreInRoi(cx, cy)) valids.push(sn);
                }
                onFrame(valids);
              } catch {
                /* transient — keep scanning */
              }
            }
            raf = requestAnimationFrame(loop);
          };
          raf = requestAnimationFrame(loop);
        } else {
          const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
            import("@zxing/browser"),
            import("@zxing/library"),
          ]);
          const hints = new Map<number, unknown>();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93]);
          const reader = new BrowserMultiFormatReader(hints);
          zx = await reader.decodeFromVideoElement(v, (res) => {
            if (!res) return;
            const sn = cleanSerial(res.getText());
            if (!isXbloomSerial(sn)) return;
            // Keep it only if it sits inside the aim box (when ZXing reports points).
            const pts = res.getResultPoints?.() ?? [];
            if (pts.length && v.videoWidth) {
              let sx = 0;
              let sy = 0;
              for (const p of pts) {
                sx += p.getX();
                sy += p.getY();
              }
              if (!centreInRoi(sx / pts.length / v.videoWidth, sy / pts.length / v.videoHeight)) return;
            }
            onFrame([sn]);
          });
        }
      } catch {
        if (!cancelled) setError(t("scan.cameraDenied"));
      }
    }

    start();
    return () => {
      cancelled = true;
      stopped.current = true;
      stopAll();
    };
  }, [t]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn((v) => !v);
    } catch {
      /* ignore */
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black">
      <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />

      {/* dimmed mask with a clear aiming window */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-28 w-72 max-w-[82vw] rounded-xl2 border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
      </div>

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
        <p className={`max-w-[75%] rounded-xl2 px-3 py-2 text-sm text-white ${hint ? "bg-accent/90 font-medium" : "bg-black/50"}`}>
          {hint || t("scan.aim")}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white"
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 p-6">
        {torchOk && (
          <button
            type="button"
            onClick={toggleTorch}
            className={`flex items-center gap-1.5 rounded-xl2 px-4 py-2.5 text-sm font-medium ${torchOn ? "bg-white text-ink" : "bg-black/50 text-white"}`}
          >
            <Icon name="info" size={16} />
            {t("scan.torch")}
          </button>
        )}
        <button type="button" onClick={onUsePhoto} className="rounded-xl2 bg-black/50 px-4 py-2.5 text-sm font-medium text-white">
          {t("scan.typeInstead")}
        </button>
      </div>

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 p-6 text-center">
          <Icon name="alert" size={32} className="text-white" />
          <p className="text-sm text-white">{error}</p>
          <button type="button" onClick={onUsePhoto} className="rounded-xl2 bg-white px-4 py-2.5 text-sm font-medium text-ink">
            {t("scan.typeInstead")}
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
