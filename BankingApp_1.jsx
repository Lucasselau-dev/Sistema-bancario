import { useState, useReducer } from "react";

const genId = () => "ID" + Math.random().toString(36).substr(2, 6).toUpperCase();
const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const SEED = {
  accounts: [
    { id: "ACC001", nome: "João Silva",      tipo: "corrente",  saldo: 15420.5, agencia: "0001", numero: "12345-6", createdAt: "2025-01-15T10:00:00Z", ativo: true },
    { id: "ACC002", nome: "Maria Santos",    tipo: "poupança",  saldo: 8750.0,  agencia: "0001", numero: "67890-1", createdAt: "2025-02-20T14:30:00Z", ativo: true },
    { id: "ACC003", nome: "Carlos Oliveira", tipo: "salário",   saldo: 3200.0,  agencia: "0002", numero: "11223-4", createdAt: "2025-03-10T09:15:00Z", ativo: true },
  ],
  transactions: [
    { id: "TXN001", tipo: "deposito",       valor: 5000, origem: null,    destino: "ACC001", descricao: "Depósito inicial",          data: "2025-01-15T10:05:00Z" },
    { id: "TXN002", tipo: "transferencia",  valor: 1500, origem: "ACC001",destino: "ACC002", descricao: "Transferência PIX",          data: "2025-03-01T11:00:00Z" },
    { id: "TXN003", tipo: "saque",          valor: 300,  origem: "ACC002",destino: null,    descricao: "Saque caixa eletrônico",     data: "2025-03-05T16:00:00Z" },
    { id: "TXN004", tipo: "deposito",       valor: 2200, origem: null,    destino: "ACC003", descricao: "Salário referente a março", data: "2025-03-10T09:20:00Z" },
  ],
};

function reducer(state, action) {
  switch (action.type) {
    case "CREATE_ACCOUNT": {
      const acc = { ...action.payload, id: genId(), createdAt: new Date().toISOString(), ativo: true, saldo: parseFloat(action.payload.saldo) || 0 };
      return { ...state, accounts: [...state.accounts, acc] };
    }
    case "UPDATE_ACCOUNT":
      return { ...state, accounts: state.accounts.map((a) => (a.id === action.payload.id ? { ...a, ...action.payload } : a)) };
    case "DELETE_ACCOUNT":
      return { ...state, accounts: state.accounts.filter((a) => a.id !== action.id) };
    case "ADD_TRANSACTION": {
      const txn = { ...action.payload, id: genId(), data: new Date().toISOString(), valor: parseFloat(action.payload.valor) };
      const accounts = state.accounts.map((a) => {
        if (txn.tipo === "deposito" && a.id === txn.destino) return { ...a, saldo: a.saldo + txn.valor };
        if (txn.tipo === "saque" && a.id === txn.origem) return { ...a, saldo: a.saldo - txn.valor };
        if (txn.tipo === "transferencia") {
          if (a.id === txn.origem) return { ...a, saldo: a.saldo - txn.valor };
          if (a.id === txn.destino) return { ...a, saldo: a.saldo + txn.valor };
        }
        return a;
      });
      return { ...state, accounts, transactions: [txn, ...state.transactions] };
    }
    default:
      return state;
  }
}

function runTests(state) {
  const results = [];
  const assert = (name, pass, msg) => results.push({ name, pass, msg: pass ? "passou" : msg || "falhou" });

  assert("Banco inicializado com contas", state.accounts.length >= 3, "Esperado >= 3 contas");
  assert("Transações inicializadas", state.transactions.length >= 4, "Esperado >= 4 transações");
  assert("Contas ativas existem", state.accounts.filter((a) => a.ativo).length > 0, "Nenhuma conta ativa");
  assert("Saldos não negativos", state.accounts.every((a) => a.saldo >= 0), "Conta(s) com saldo negativo");

  const validTypes = ["deposito", "saque", "transferencia"];
  assert("Tipos de transação válidos", state.transactions.every((t) => validTypes.includes(t.tipo)), "Tipo inválido encontrado");
  assert("Transferências com origem e destino", state.transactions.filter((t) => t.tipo === "transferencia").every((t) => t.origem && t.destino), "Transferência sem origem/destino");
  assert("Depósitos com conta destino", state.transactions.filter((t) => t.tipo === "deposito").every((t) => t.destino), "Depósito sem destino");
  assert("Saques com conta origem", state.transactions.filter((t) => t.tipo === "saque").every((t) => t.origem), "Saque sem origem");
  assert("Valores de transação positivos", state.transactions.every((t) => t.valor > 0), "Transação com valor <= 0");
  assert("Campos obrigatórios nas contas", state.accounts.every((a) => a.nome && a.agencia && a.numero), "Campos faltando");
  assert("IDs únicos nas contas", new Set(state.accounts.map((a) => a.id)).size === state.accounts.length, "IDs duplicados");
  assert("IDs únicos nas transações", new Set(state.transactions.map((t) => t.id)).size === state.transactions.length, "IDs duplicados");

  return results;
}

const TIPO_LABEL = { deposito: "Depósito", saque: "Saque", transferencia: "Transferência" };
const TIPO_COLOR = { deposito: "success", saque: "danger", transferencia: "info" };
const TABS = [
  { id: "dashboard",  label: "Dashboard" },
  { id: "contas",     label: "Contas" },
  { id: "transacoes", label: "Transações" },
  { id: "testes",     label: "Testes de Qualidade" },
];

const BLANK_ACC  = { nome: "", tipo: "corrente", agencia: "0001", numero: "", saldo: "" };
const BLANK_TXN  = { tipo: "deposito", valor: "", origem: "", destino: "", descricao: "" };

export default function BankingApp() {
  const [state, dispatch]       = useReducer(reducer, SEED);
  const [tab, setTab]           = useState("dashboard");
  const [modal, setModal]       = useState(null);
  const [accForm, setAccForm]   = useState(BLANK_ACC);
  const [txnForm, setTxnForm]   = useState(BLANK_TXN);
  const [testRes, setTestRes]   = useState(null);
  const [toast, setToast]       = useState(null);

  const notify = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const active = state.accounts.filter((a) => a.ativo);
  const totalBalance = active.reduce((s, a) => s + a.saldo, 0);
  const accName = (id) => { const a = state.accounts.find((x) => x.id === id); return a ? a.nome : "—"; };

  const handleCreateAccount = () => {
    if (!accForm.nome || !accForm.numero) { notify("Preencha nome e número da conta", "error"); return; }
    dispatch({ type: "CREATE_ACCOUNT", payload: accForm });
    setAccForm(BLANK_ACC); setModal(null); notify("Conta criada com sucesso!");
  };
  const handleUpdateAccount = () => {
    dispatch({ type: "UPDATE_ACCOUNT", payload: modal.data }); setModal(null); notify("Conta atualizada!");
  };
  const handleDeleteAccount = (id) => {
    dispatch({ type: "DELETE_ACCOUNT", id }); setModal(null); notify("Conta removida!");
  };
  const handleTransaction = () => {
    const val = parseFloat(txnForm.valor);
    if (!val || val <= 0) { notify("Valor inválido", "error"); return; }
    if (txnForm.tipo !== "deposito" && !txnForm.origem)  { notify("Selecione a conta de origem", "error"); return; }
    if (txnForm.tipo !== "saque"    && !txnForm.destino) { notify("Selecione a conta destino",  "error"); return; }
    if (txnForm.tipo === "transferencia" && txnForm.origem === txnForm.destino) { notify("Origem e destino iguais", "error"); return; }
    if (txnForm.tipo !== "deposito") {
      const src = state.accounts.find((a) => a.id === txnForm.origem);
      if (src && src.saldo < val) { notify("Saldo insuficiente", "error"); return; }
    }
    dispatch({ type: "ADD_TRANSACTION", payload: txnForm });
    setTxnForm(BLANK_TXN); notify("Transação realizada!");
  };

  const s = { fontFamily: "var(--font-sans)", padding: "1.5rem 1rem", maxWidth: 900, margin: "0 auto", position: "relative" };

  return (
    <div style={s}>
      {toast && (
        <div style={{
          position: "absolute", top: 0, right: 0, zIndex: 50,
          padding: "10px 16px", borderRadius: "var(--border-radius-md)", fontSize: 13, fontWeight: 500,
          background: toast.type === "error" ? "var(--color-background-danger)" : "var(--color-background-success)",
          color:      toast.type === "error" ? "var(--color-text-danger)"      : "var(--color-text-success)",
          border: `0.5px solid`, borderColor: toast.type === "error" ? "var(--color-border-danger)" : "var(--color-border-success)",
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem" }}>
        <div style={{ width: 36, height: 36, borderRadius: "var(--border-radius-md)", background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="var(--color-text-info)" strokeWidth="2" strokeLinecap="round"/><path d="M9 22V12h6v10" stroke="var(--color-text-info)" strokeWidth="2" strokeLinecap="round"/></svg>
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 500, fontSize: 16, color: "var(--color-text-primary)" }}>BancoApp</p>
          <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)" }}>Sistema Bancário · banco de dados em memória + CRUD + testes</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: "1.5rem", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 14px", fontSize: 13, background: "transparent", border: "none", cursor: "pointer",
            fontWeight: tab === t.id ? 500 : 400,
            color: tab === t.id ? "var(--color-text-primary)" : "var(--color-text-secondary)",
            borderBottom: tab === t.id ? "2px solid var(--color-text-primary)" : "2px solid transparent",
            marginBottom: -1, borderRadius: 0,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── DASHBOARD ─────────────────────────────────────────────── */}
      {tab === "dashboard" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: "1.5rem" }}>
            {[
              { label: "Patrimônio total",  value: fmt(totalBalance) },
              { label: "Contas ativas",     value: active.length },
              { label: "Transações",        value: state.transactions.length },
              { label: "Última operação",   value: state.transactions[0] ? fmt(state.transactions[0].valor) : "—" },
            ].map((c) => (
              <div key={c.label} style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "1rem" }}>
                <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--color-text-secondary)" }}>{c.label}</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>{c.value}</p>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: "var(--color-text-secondary)" }}>Transações recentes</p>
          <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
            {state.transactions.slice(0, 6).map((txn, i, arr) => (
              <div key={txn.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: i < arr.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none", background: "var(--color-background-primary)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: `var(--color-background-${TIPO_COLOR[txn.tipo]})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, color: `var(--color-text-${TIPO_COLOR[txn.tipo]})` }}>
                    {txn.tipo === "deposito" ? "D" : txn.tipo === "saque" ? "S" : "T"}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{txn.descricao || TIPO_LABEL[txn.tipo]}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-secondary)" }}>
                      {txn.tipo === "transferencia" ? `${accName(txn.origem)} → ${accName(txn.destino)}` : accName(txn.destino || txn.origem)}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: txn.tipo === "deposito" ? "var(--color-text-success)" : txn.tipo === "saque" ? "var(--color-text-danger)" : "var(--color-text-primary)" }}>
                    {txn.tipo === "deposito" ? "+" : txn.tipo === "saque" ? "-" : ""}{fmt(txn.valor)}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-secondary)" }}>{fmtDate(txn.data)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CONTAS ────────────────────────────────────────────────── */}
      {tab === "contas" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-secondary)" }}>{active.length} conta(s) ativa(s)</p>
            <button onClick={() => setModal({ type: "create" })} style={{ fontSize: 13, padding: "7px 14px" }}>+ Nova conta</button>
          </div>
          <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
            {active.length === 0 && <div style={{ padding: "2rem", textAlign: "center", fontSize: 13, color: "var(--color-text-secondary)" }}>Nenhuma conta. Crie a primeira.</div>}
            {active.map((acc, i) => (
              <div key={acc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: i < active.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none", background: "var(--color-background-primary)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, color: "var(--color-text-info)" }}>
                    {acc.nome.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{acc.nome}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-secondary)" }}>Ag. {acc.agencia} · C/C {acc.numero} · {acc.tipo}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: acc.saldo >= 0 ? "var(--color-text-success)" : "var(--color-text-danger)" }}>{fmt(acc.saldo)}</p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setModal({ type: "edit", data: { ...acc } })} style={{ fontSize: 11, padding: "4px 10px" }}>Editar</button>
                    <button onClick={() => setModal({ type: "delete", data: acc })} style={{ fontSize: 11, padding: "4px 10px", color: "var(--color-text-danger)", borderColor: "var(--color-border-danger)" }}>Excluir</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TRANSAÇÕES ────────────────────────────────────────────── */}
      {tab === "transacoes" && (
        <div>
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1.25rem", marginBottom: "1.5rem" }}>
            <p style={{ margin: "0 0 12px", fontWeight: 500, fontSize: 14 }}>Nova transação</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Tipo</label>
                <select value={txnForm.tipo} onChange={(e) => setTxnForm({ ...BLANK_TXN, tipo: e.target.value })} style={{ width: "100%" }}>
                  <option value="deposito">Depósito</option>
                  <option value="saque">Saque</option>
                  <option value="transferencia">Transferência</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Valor (R$)</label>
                <input type="number" min="0.01" step="0.01" value={txnForm.valor} onChange={(e) => setTxnForm({ ...txnForm, valor: e.target.value })} placeholder="0,00" style={{ width: "100%" }} />
              </div>
              {(txnForm.tipo === "saque" || txnForm.tipo === "transferencia") && (
                <div>
                  <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Conta origem</label>
                  <select value={txnForm.origem} onChange={(e) => setTxnForm({ ...txnForm, origem: e.target.value })} style={{ width: "100%" }}>
                    <option value="">Selecione...</option>
                    {active.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </div>
              )}
              {(txnForm.tipo === "deposito" || txnForm.tipo === "transferencia") && (
                <div>
                  <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Conta destino</label>
                  <select value={txnForm.destino} onChange={(e) => setTxnForm({ ...txnForm, destino: e.target.value })} style={{ width: "100%" }}>
                    <option value="">Selecione...</option>
                    {active.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Descrição</label>
                <input type="text" value={txnForm.descricao} onChange={(e) => setTxnForm({ ...txnForm, descricao: e.target.value })} placeholder="Opcional" style={{ width: "100%" }} />
              </div>
            </div>
            <button onClick={handleTransaction} style={{ fontSize: 13, padding: "8px 16px" }}>Confirmar transação</button>
          </div>

          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 10 }}>{state.transactions.length} transação(ões) no histórico</p>
          <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
            {state.transactions.map((txn, i, arr) => (
              <div key={txn.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: i < arr.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none", background: "var(--color-background-primary)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: "var(--border-radius-md)", background: `var(--color-background-${TIPO_COLOR[txn.tipo]})`, color: `var(--color-text-${TIPO_COLOR[txn.tipo]})`, fontWeight: 500 }}>{TIPO_LABEL[txn.tipo]}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 13 }}>{txn.descricao || "—"}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-secondary)" }}>
                      {txn.tipo === "transferencia" ? `${accName(txn.origem)} → ${accName(txn.destino)}` : txn.tipo === "deposito" ? `→ ${accName(txn.destino)}` : `← ${accName(txn.origem)}`}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{fmt(txn.valor)}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-secondary)" }}>{fmtDate(txn.data)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TESTES DE QUALIDADE ───────────────────────────────────── */}
      {tab === "testes" && (
        <div>
          <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-lg)", padding: "1.25rem", marginBottom: "1.5rem" }}>
            <p style={{ margin: "0 0 6px", fontWeight: 500, fontSize: 14 }}>Suite de testes de qualidade</p>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--color-text-secondary)" }}>
              12 testes automatizados verificam integridade do banco, validação de campos, unicidade de IDs, consistência de transações e regras de negócio.
            </p>
            <button onClick={() => setTestRes(runTests(state))} style={{ fontSize: 13, padding: "8px 16px" }}>▶ Executar todos os testes</button>
          </div>

          {testRes && (
            <div>
              <div style={{ display: "flex", gap: 10, marginBottom: "1rem" }}>
                <div style={{ background: "var(--color-background-success)", borderRadius: "var(--border-radius-md)", padding: "8px 14px" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-success)" }}>{testRes.filter((t) => t.pass).length} passaram</span>
                </div>
                <div style={{ background: "var(--color-background-danger)", borderRadius: "var(--border-radius-md)", padding: "8px 14px" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-danger)" }}>{testRes.filter((t) => !t.pass).length} falharam</span>
                </div>
                <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "8px 14px" }}>
                  <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{testRes.length} total</span>
                </div>
              </div>

              <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
                {testRes.map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderBottom: i < testRes.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none", background: "var(--color-background-primary)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", background: t.pass ? "var(--color-background-success)" : "var(--color-background-danger)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: t.pass ? "var(--color-text-success)" : "var(--color-text-danger)" }}>
                        {t.pass ? "✓" : "✗"}
                      </div>
                      <p style={{ margin: 0, fontSize: 13 }}>{t.name}</p>
                    </div>
                    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: "var(--border-radius-md)", background: t.pass ? "var(--color-background-success)" : "var(--color-background-danger)", color: t.pass ? "var(--color-text-success)" : "var(--color-text-danger)" }}>
                      {t.msg}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODALS ────────────────────────────────────────────────── */}
      {modal && (
        <div style={{ position: "absolute", inset: 0, minHeight: "100%", background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 80 }} onClick={() => setModal(null)}>
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1.5rem", width: "100%", maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>

            {modal.type === "create" && (
              <>
                <p style={{ margin: "0 0 1rem", fontWeight: 500, fontSize: 16 }}>Nova conta</p>
                {[{ label: "Nome completo", key: "nome", type: "text" }, { label: "Agência", key: "agencia", type: "text" }, { label: "Número da conta", key: "numero", type: "text" }, { label: "Saldo inicial (R$)", key: "saldo", type: "number" }].map((f) => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>{f.label}</label>
                    <input type={f.type} value={accForm[f.key]} onChange={(e) => setAccForm({ ...accForm, [f.key]: e.target.value })} style={{ width: "100%" }} />
                  </div>
                ))}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Tipo de conta</label>
                  <select value={accForm.tipo} onChange={(e) => setAccForm({ ...accForm, tipo: e.target.value })} style={{ width: "100%" }}>
                    <option value="corrente">Corrente</option><option value="poupança">Poupança</option><option value="salário">Salário</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleCreateAccount} style={{ flex: 1, padding: 9, fontSize: 13 }}>Criar conta</button>
                  <button onClick={() => setModal(null)} style={{ flex: 1, padding: 9, fontSize: 13 }}>Cancelar</button>
                </div>
              </>
            )}

            {modal.type === "edit" && (
              <>
                <p style={{ margin: "0 0 1rem", fontWeight: 500, fontSize: 16 }}>Editar conta</p>
                {[{ label: "Nome completo", key: "nome", type: "text" }, { label: "Agência", key: "agencia", type: "text" }, { label: "Número da conta", key: "numero", type: "text" }].map((f) => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>{f.label}</label>
                    <input type={f.type} value={modal.data[f.key]} onChange={(e) => setModal({ ...modal, data: { ...modal.data, [f.key]: e.target.value } })} style={{ width: "100%" }} />
                  </div>
                ))}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Tipo de conta</label>
                  <select value={modal.data.tipo} onChange={(e) => setModal({ ...modal, data: { ...modal.data, tipo: e.target.value } })} style={{ width: "100%" }}>
                    <option value="corrente">Corrente</option><option value="poupança">Poupança</option><option value="salário">Salário</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleUpdateAccount} style={{ flex: 1, padding: 9, fontSize: 13 }}>Salvar alterações</button>
                  <button onClick={() => setModal(null)} style={{ flex: 1, padding: 9, fontSize: 13 }}>Cancelar</button>
                </div>
              </>
            )}

            {modal.type === "delete" && (
              <>
                <p style={{ margin: "0 0 8px", fontWeight: 500, fontSize: 16 }}>Excluir conta?</p>
                <p style={{ margin: "0 0 1.5rem", fontSize: 13, color: "var(--color-text-secondary)" }}>
                  A conta de <strong>{modal.data.nome}</strong> será removida permanentemente. Esta ação não pode ser desfeita.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleDeleteAccount(modal.data.id)} style={{ flex: 1, padding: 9, fontSize: 13, color: "var(--color-text-danger)", borderColor: "var(--color-border-danger)" }}>Excluir</button>
                  <button onClick={() => setModal(null)} style={{ flex: 1, padding: 9, fontSize: 13 }}>Cancelar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
