import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useI18n } from "../../../lib/i18n";
import Modal from "../../../components/Modal";
import { SkeletonTable } from "../../../components/Skeleton";
import { confirmAdminPin, swalError, swalToast } from "../../../lib/swal";
import { TextField } from "../../../components/ui";

export default function ProductsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: api.listProducts, enabled: open });
  const refresh = () => qc.invalidateQueries({ queryKey: ["products"] });

  async function add() {
    if (!name.trim()) {
      swalError(t("msg.error"), t("val.modelNameRequired"));
      return;
    }
    try {
      await api.createProduct({ name: name.trim(), code: code.trim() || undefined });
      setName("");
      setCode("");
      swalToast("success", t("msg.added"));
      refresh();
    } catch (e) {
      swalError(e instanceof Error ? e.message : t("msg.error"));
    }
  }

  async function remove(id: number) {
    const pin = await confirmAdminPin(t("msg.adminConfirm"), t("msg.confirmDeleteProduct"));
    if (!pin) return;
    try {
      await api.deleteProduct(id, pin);
      swalToast("success", t("msg.deleted"));
      refresh();
    } catch (e) {
      swalError(e instanceof Error ? e.message : t("msg.error"));
    }
  }

  return (
    <Modal open={open} title={t("mg.products")} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <TextField label={t("mg.modelName")} value={name} onChange={(e) => setName(e.target.value)} placeholder="xBloom Studio …" />
          </div>
          <div className="w-28">
            <TextField label={t("mg.code")} value={code} onChange={(e) => setCode(e.target.value)} placeholder="XB-…" />
          </div>
          <button onClick={add} className="h-[42px] shrink-0 rounded-xl2 bg-ink px-4 text-sm font-medium text-white transition hover:opacity-90">
            {t("mg.add")}
          </button>
        </div>

        {isLoading ? (
          <SkeletonTable rows={3} cols={2} />
        ) : (
          <ul className="divide-y divide-line rounded-xl2 border border-line">
            {data?.data.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>
                  {p.name} {p.code && <span className="text-muted">· {p.code}</span>}
                </span>
                {isAdmin && (
                  <button onClick={() => remove(p.id)} className="text-xs text-red hover:underline">
                    {t("mg.remove")}
                  </button>
                )}
              </li>
            ))}
            {data?.data.length === 0 && <li className="px-3 py-3 text-sm text-muted">{t("mg.noProducts")}</li>}
          </ul>
        )}
      </div>
    </Modal>
  );
}
