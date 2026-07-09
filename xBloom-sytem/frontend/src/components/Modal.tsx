import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export default function Modal({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  // Render to document.body so the fixed overlay is positioned relative to the
  // viewport — not trapped inside an ancestor that has a CSS transform (e.g. the
  // `.fade-in` tab wrapper), which would otherwise push the modal off-centre.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`fade-in max-h-[90vh] w-full overflow-y-auto rounded-t-xl2 border border-line bg-white p-5 sm:rounded-xl2 ${
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl font-light text-ink">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
