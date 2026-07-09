import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type StaffUser } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useI18n } from "../../../lib/i18n";
import { SkeletonTable } from "../../../components/Skeleton";
import { confirmAdminPin, swalError, swalToast } from "../../../lib/swal";
import { Button, SelectField, TextField } from "../../../components/ui";
import { Empty, IconAction, RowActions } from "../../../components/staff/ui";
import Modal from "../../../components/Modal";

// Loginable staff roles (customer is a non-login placeholder, so not offered).
const ROLES = [
  { value: "staff", labelKey: "role.staff" },
  { value: "tech", labelKey: "role.tech" },
  { value: "admin", labelKey: "role.admin" },
];

export default function Users() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState("staff");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["users"], queryFn: api.listUsers });
  const refresh = () => qc.invalidateQueries({ queryKey: ["users"] });

  async function add() {
    if (!name.trim()) {
      swalError(t("msg.error"), t("val.userNameRequired"));
      return;
    }
    if (pin.trim().length < 4) {
      swalError(t("msg.error"), t("val.pinMin"));
      return;
    }
    setBusy(true);
    try {
      await api.createUser({ name: name.trim(), pin: pin.trim(), role });
      setName("");
      setPin("");
      setRole("staff");
      swalToast("success", t("users.created"));
      refresh();
    } catch (e) {
      swalError(t("msg.error"), e instanceof Error ? e.message : "");
    } finally {
      setBusy(false);
    }
  }

  async function remove(u: StaffUser) {
    const adminPin = await confirmAdminPin(t("users.deleteTitle"), t("users.deleteText"));
    if (!adminPin) return;
    try {
      await api.deleteUser(u.name, adminPin);
      swalToast("success", t("users.deleted"));
      refresh();
    } catch (e) {
      swalError(t("msg.error"), e instanceof Error ? e.message : "");
    }
  }

  return (
    <div className="fade-in">
      <h2 className="mb-1 text-2xl font-bold text-ink">{t("users.title")}</h2>
      <p className="mb-4 text-sm text-muted">{t("users.subtitle")}</p>

      <div className="mb-5 rounded-xl2 border border-line bg-card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_160px_auto] sm:items-end">
          <TextField label={t("users.name")} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Somchai" />
          <TextField label={t("users.pin")} type="password" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <SelectField label={t("users.role")} value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {t(r.labelKey)}
              </option>
            ))}
          </SelectField>
          <Button onClick={add} disabled={busy}>
            {busy ? t("crm.saving") : t("users.add")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={5} cols={3} />
      ) : !data || data.data.length === 0 ? (
        <Empty>{t("users.empty")}</Empty>
      ) : (
        <div className="overflow-hidden rounded-xl2 border border-line">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-card2 text-left text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">{t("users.colName")}</th>
                <th className="px-3 py-2 font-medium">{t("users.colRole")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.data.map((u) => (
                <tr key={u.name} className="border-b border-line/70 hover:bg-card">
                  <td className="px-3 py-2 font-medium text-ink">{u.name}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-card2 px-2.5 py-0.5 text-xs text-ink2">{t(`role.${u.role}`)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <RowActions>
                      <IconAction name="edit" label={t("users.manage")} onClick={() => setEditing(u)} />
                      {u.name !== user?.name && <IconAction name="trash" label={t("common.delete")} tone="danger" onClick={() => remove(u)} />}
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <EditUserModal user={editing} self={editing.name === user?.name} onClose={() => setEditing(null)} onSaved={refresh} />}
    </div>
  );
}

function EditUserModal({ user, self, onClose, onSaved }: { user: StaffUser; self: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [role, setRole] = useState<string>(user.role);
  const [newPin, setNewPin] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const patch: { role?: string; pin?: string } = {};
    if (role !== user.role) patch.role = role;
    if (newPin.trim()) {
      if (newPin.trim().length < 4) {
        swalError(t("msg.error"), t("val.pinMin"));
        return;
      }
      patch.pin = newPin.trim();
    }
    if (!patch.role && !patch.pin) {
      onClose();
      return;
    }
    const adminPin = await confirmAdminPin(t("msg.adminConfirm"), t("users.editTitle", { name: user.name }));
    if (!adminPin) return;
    setBusy(true);
    try {
      await api.updateUser(user.name, patch, adminPin);
      swalToast("success", t("users.updated"));
      onSaved();
      onClose();
    } catch (e) {
      swalError(t("msg.error"), e instanceof Error ? e.message : "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={t("users.editTitle", { name: user.name })} onClose={onClose}>
      <div className="space-y-3">
        <SelectField label={t("users.role")} value={role} onChange={(e) => setRole(e.target.value)} disabled={self}>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {t(r.labelKey)}
            </option>
          ))}
        </SelectField>
        {self && <p className="-mt-1 text-xs text-muted">{t("users.selfRoleLock")}</p>}
        <TextField label={t("users.newPin")} type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} hint={t("users.newPinHint")} />
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button className="flex-1" onClick={save} disabled={busy}>
            {busy ? t("crm.saving") : t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
