"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import type { CatalogModel, ModelConfig, ModelSettings, RunEvent, RunResult } from "@/lib/types";

const STORAGE_KEY = "prompt-playground:v1";
const DEFAULT_SYSTEM_PROMPT = "You are an asshole scientist that will always teach people how something works in a pedantic way regardless of whether they are asking you a question or not. You will find a subject related to what they write to you and give them back a sassy educational response. ";
const DEFAULT_USER_PROMPT = "Why is the sky blue?";
const starters: ModelConfig[] = [
  { instanceId: "starter-1", modelId: "openai/gpt-5-mini", displayName: "GPT-5-Mini", provider: "OpenAI", settings: {} },
  { instanceId: "starter-2", modelId: "anthropic/claude-sonnet-4", displayName: "Claude Sonnet 4", provider: "Anthropic", settings: {} },
  { instanceId: "starter-3", modelId: "google/gemini-2.5-pro", displayName: "Gemini 2.5 Pro", provider: "Google", settings: {} },
];
const emptyResult = (): RunResult => ({ status: "idle", content: "" });
const uid = () => crypto.randomUUID();

export default function Playground() {
  const [system, setSystem] = useState(DEFAULT_SYSTEM_PROMPT); const [user, setUser] = useState(DEFAULT_USER_PROMPT);
  const [models, setModels] = useState<ModelConfig[]>(starters); const [catalog, setCatalog] = useState<CatalogModel[]>([]);
  const [results, setResults] = useState<Record<string, RunResult>>({}); const [editing, setEditing] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState(""); const abortRef = useRef<AbortController | null>(null); const hydrated = useRef(false);
  const running = Object.values(results).some(r => r.status === "streaming");

  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"); if (saved?.version === 1) { setSystem(saved.system || DEFAULT_SYSTEM_PROMPT); setUser(saved.user || DEFAULT_USER_PROMPT); if (Array.isArray(saved.models) && saved.models.length) setModels(saved.models); } } catch {} hydrated.current = true; }, []);
  useEffect(() => { if (hydrated.current) localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, system, user, models })); }, [system, user, models]);
  useEffect(() => { fetch("/api/models").then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setCatalog(j.models); }).catch(e => setCatalogError(e.message)); }, []);
  useEffect(() => () => abortRef.current?.abort(), []);

  function applyEvent(event: RunEvent) {
    setResults(current => { const prior = current[event.instanceId] ?? emptyResult();
      if (event.type === "start") return { ...current, [event.instanceId]: { ...emptyResult(), status: "streaming", startedAt: event.at } };
      if (event.type === "delta") return { ...current, [event.instanceId]: { ...prior, content: prior.content + event.content, firstTokenAt: prior.firstTokenAt ?? event.at } };
      if (event.type === "complete") return { ...current, [event.instanceId]: { ...prior, status: "completed", completedAt: event.at, promptTokens: event.promptTokens, completionTokens: event.completionTokens, cost: event.cost, estimatedCost: event.estimatedCost } };
      if (event.type === "cancelled") return { ...current, [event.instanceId]: { ...prior, status: "cancelled", completedAt: Date.now() } };
      return { ...current, [event.instanceId]: { ...prior, status: "failed", error: event.message, completedAt: Date.now() } };
    });
  }
  async function submit(only?: ModelConfig) {
    if (running) return; const selected = only ? [only] : models; const controller = new AbortController(); abortRef.current = controller;
    setResults(current => ({ ...current, ...Object.fromEntries(selected.map(m => [m.instanceId, { ...emptyResult(), status: "streaming" }])) }));
    try { const response = await fetch("/api/run", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system, user, models: selected }) });
      if (!response.ok) { const j = await response.json(); throw new Error(j.error ?? "Unable to start run"); } if (!response.body) throw new Error("Missing response stream");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() ?? ""; for (const line of lines) if (line.trim()) applyEvent(JSON.parse(line)); }
    } catch (error) { if (!controller.signal.aborted) selected.forEach(m => applyEvent({ type: "error", instanceId: m.instanceId, message: error instanceof Error ? error.message : "Run failed" })); }
    finally { if (abortRef.current === controller) abortRef.current = null; }
  }
  function cancel() { abortRef.current?.abort(); models.forEach(m => { if (results[m.instanceId]?.status === "streaming") applyEvent({ type: "cancelled", instanceId: m.instanceId }); }); }
  const active = editing ? models.find(m => m.instanceId === editing) : undefined;

  return <main className="playground">
    <header>Playground</header>
    <section className="content">
      <aside className="prompt-box">
        <div className="prompt-fields"><PromptField label="System" value={system} onChange={setSystem}/><PromptField label="User" value={user} onChange={setUser}/></div>
        <button className="submit" onClick={() => running ? cancel() : submit()} disabled={!running && (!user.trim() || models.length === 0)}>{running ? "Cancel" : "Submit"}</button>
      </aside>
      {models.map(model => <ResultColumn key={model.instanceId} model={model} result={results[model.instanceId] ?? emptyResult()} onEdit={() => setEditing(model.instanceId)} onRetry={() => submit(model)}/>)}
      <button className="add-column" onClick={() => setEditing("new")} aria-label="Add model">+</button>
    </section>
    {editing && <ModelModal model={active} catalog={catalog} catalogError={catalogError} onClose={() => setEditing(null)} onSave={next => { setModels(list => active ? list.map(m => m.instanceId === active.instanceId ? next : m) : [...list, next]); setEditing(null); }} onRemove={active ? () => { setModels(list => list.filter(m => m.instanceId !== active.instanceId)); setEditing(null); } : undefined} onMove={active ? direction => setModels(list => { const i = list.findIndex(m => m.instanceId === active.instanceId), j = i + direction; if (j < 0 || j >= list.length) return list; const next = [...list]; [next[i], next[j]] = [next[j], next[i]]; return next; }) : undefined}/>} 
  </main>;
}

function PromptField({ label, value, onChange }: { label: string; value: string; onChange: (v:string)=>void }) { return <label className="prompt-field"><span>{label}</span><textarea value={value} onChange={e => onChange(e.target.value)} placeholder={`Enter a ${label.toLowerCase()} prompt…`}/></label>; }
function formatSeconds(ms?: number) { return ms == null ? "—" : `${(ms / 1000).toFixed(1)}s`; }
function ResultColumn({ model, result, onEdit, onRetry }: { model: ModelConfig; result: RunResult; onEdit:()=>void; onRetry:()=>void }) {
  const input = result.startedAt && result.firstTokenAt ? result.firstTokenAt - result.startedAt : undefined; const output = result.firstTokenAt && result.completedAt ? result.completedAt - result.firstTokenAt : undefined;
  return <article className="result-column"><div className="result-box"><button className="model-pill" onClick={onEdit}>{model.displayName}{model.settings.reasoning?.effort ? ` • ${model.settings.reasoning.effort} thinking` : ""}</button><div className={`result-body ${result.status}`}>
    {result.content ? <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{result.content}</ReactMarkdown> : result.status === "streaming" ? <p className="muted">Waiting for response…</p> : result.status === "failed" ? <><p className="error">{result.error}</p><button className="retry" onClick={onRetry}>Retry</button></> : result.status === "cancelled" ? <p className="muted">Run cancelled.</p> : <p className="muted">Your response will appear here.</p>}
  </div></div><dl className="metrics"><div><dt>Response time in / out</dt><dd>{formatSeconds(input)} / {formatSeconds(output)}</dd></div><div><dt>Tokens in/out</dt><dd>{result.promptTokens ?? "—"} / {result.completionTokens ?? "—"}</dd></div><div><dt>Cost</dt><dd>{result.cost == null ? "—" : `${result.estimatedCost ? "~" : ""}$${result.cost.toFixed(result.cost < .01 ? 5 : 3)}`}</dd></div></dl></article>;
}

function ModelModal({ model, catalog, catalogError, onClose, onSave, onRemove, onMove }: { model?: ModelConfig; catalog: CatalogModel[]; catalogError: string; onClose:()=>void; onSave:(m:ModelConfig)=>void; onRemove?:()=>void; onMove?:(d:-1|1)=>void }) {
  const [query,setQuery]=useState(""); const [selected,setSelected]=useState(model?.modelId ?? ""); const [settings,setSettings]=useState<ModelSettings>(model?.settings ?? {}); const closeRef=useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); const fn=(e:KeyboardEvent)=>e.key==="Escape"&&onClose(); document.addEventListener("keydown",fn); return()=>document.removeEventListener("keydown",fn); },[onClose]);
  const matches=useMemo(()=>catalog.filter(m=>(m.name+" "+m.id+" "+m.provider).toLowerCase().includes(query.toLowerCase())).slice(0,100),[catalog,query]); const item=catalog.find(m=>m.id===selected);
  function save(){ if(!item)return; onSave({instanceId:model?.instanceId??uid(),modelId:item.id,displayName:item.name,provider:item.provider,settings}); }
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><p className="eyebrow">Model settings</p><h1 id="modal-title">{model?"Configure model":"Add a model"}</h1></div><button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Close">×</button></div>
    <label className="control"><span>Find a model</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search OpenAI, Anthropic, Grok, Gemini…"/></label>
    <div className="model-list">{catalogError&&<p className="error">{catalogError}</p>}{!catalog.length&&!catalogError&&<p className="muted">Loading live models…</p>}{matches.map(m=><button className={selected===m.id?"selected":""} key={m.id} onClick={()=>{setSelected(m.id);setSettings({});}}><span>{m.name}</span><small>{m.provider} · {m.contextLength.toLocaleString()} context</small></button>)}</div>
    {item&&<div className="settings"><h2>Parameters</h2>{item.supportedParameters.includes("temperature")&&<Range label="Temperature" min={0} max={2} step={.1} value={settings.temperature??1} onChange={v=>setSettings(s=>({...s,temperature:v}))}/>} {item.supportedParameters.includes("top_p")&&<Range label="Top P" min={0} max={1} step={.05} value={settings.top_p??1} onChange={v=>setSettings(s=>({...s,top_p:v}))}/>} {item.supportedParameters.includes("max_tokens")&&<NumberControl label="Max output tokens" value={settings.max_tokens??2048} onChange={v=>setSettings(s=>({...s,max_tokens:v}))}/>} {item.supportedParameters.includes("reasoning")&&<label className="control"><span>Reasoning effort</span><select value={settings.reasoning?.effort??""} onChange={e=>setSettings(s=>({...s,reasoning:e.target.value?{effort:e.target.value as "low"|"medium"|"high"}:undefined}))}><option value="">Default</option><option>low</option><option>medium</option><option>high</option></select></label>} {item.supportedParameters.includes("stop")&&<label className="control"><span>Stop sequences (comma separated)</span><input value={settings.stop?.join(", ")??""} onChange={e=>setSettings(s=>({...s,stop:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)}))}/></label>}</div>}
    <footer className="modal-actions"><div>{onRemove&&<button className="danger" onClick={onRemove}>Remove</button>}{onMove&&<><button onClick={()=>onMove(-1)}>Move left</button><button onClick={()=>onMove(1)}>Move right</button></>}</div><div><button onClick={onClose}>Cancel</button><button className="primary" disabled={!item} onClick={save}>{model?"Save":"Add model"}</button></div></footer>
  </section></div>;
}
function Range({label,min,max,step,value,onChange}:{label:string;min:number;max:number;step:number;value:number;onChange:(n:number)=>void}){return <label className="range"><span>{label}<b>{value}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>}
function NumberControl({label,value,onChange}:{label:string;value:number;onChange:(n:number)=>void}){return <label className="control"><span>{label}</span><input type="number" min="1" max="131072" value={value} onChange={e=>onChange(Number(e.target.value))}/></label>}
