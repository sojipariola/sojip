"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Github,
  Loader2,
  Rocket,
  Wand2,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Deployment,
  DeploymentTarget,
  TARGET_META,
  createDeployment,
  generateScript,
  runHealthCheck,
} from "@/lib/deployment-api";
import {
  EnvVarAddForm,
  PendingEnvVar,
} from "./EnvVarAddForm";
import { DeploymentPath } from "./PathSelector";
import { ScriptModal } from "./ScriptModal";

interface Props {
  projectId: string;
  githubRepo: string | null;
  path: DeploymentPath;
  onDeployed: (deployment: Deployment) => void | Promise<void>;
}

export function DeployForm({
  projectId,
  githubRepo,
  path,
  onDeployed,
}: Props) {
  // Env vars (used by script + url paths)
  const [pendingEnv, setPendingEnv] = useState<PendingEnvVar[]>([]);

  // Script path
  const [target, setTarget] = useState<DeploymentTarget>("railway");
  const [generatingScript, setGeneratingScript] = useState(false);
  const [script, setScript] = useState<{
    target: string;
    script: string;
    env_example: string;
  } | null>(null);
  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [createdForScript, setCreatedForScript] = useState<Deployment | null>(null);

  // URL path
  const [manualUrl, setManualUrl] = useState("");
  const [submittingUrl, setSubmittingUrl] = useState(false);

  const scriptTargets: DeploymentTarget[] = [
    "railway",
    "fly",
    "vercel",
    "docker",
    "github_pages",
    "npm",
    "pypi",
    "chrome_store",
    "local_network",
    "download",
    "custom",
  ];

  // ─── Script path: generate ─────────────────────────────
  async function handleGenerateScript() {
    setGeneratingScript(true);
    try {
      // 1. Create a deployment row with the pending env vars + target
      const envDict: Record<string, string> = {};
      for (const p of pendingEnv) envDict[p.key] = p.value;

      const deployment = await createDeployment(projectId, {
        target,
        environment: "production",
        env_vars: envDict,
      });
      setCreatedForScript(deployment);

      // 2. Generate the script using the fresh deployment's env keys
      const result = await generateScript(projectId, target, true);
      setScript(result);
      setScriptModalOpen(true);
      await onDeployed(deployment);
    } catch (e) {
      toast.error("Could not generate script", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setGeneratingScript(false);
    }
  }

  // ─── URL path: submit ──────────────────────────────────
  async function handleSubmitUrl() {
    const url = manualUrl.trim();
    if (!url) {
      toast.error("Enter a URL");
      return;
    }
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      toast.error("URL must start with http:// or https://");
      return;
    }
    setSubmittingUrl(true);
    try {
      const envDict: Record<string, string> = {};
      for (const p of pendingEnv) envDict[p.key] = p.value;

      const deployment = await createDeployment(projectId, {
        target: "custom",
        environment: "production",
        url,
        env_vars: envDict,
      });

      // Run a fresh health check
      const check = await runHealthCheck(projectId, deployment.id);
      if (check.is_healthy) {
        toast.success("Deployment is live", {
          description: "HTTP " + check.status_code,
        });
      } else {
        toast.warning("URL is not returning 200", {
          description: check.error || "HTTP " + check.status_code,
        });
      }
      await onDeployed(deployment);
      setManualUrl("");
      setPendingEnv([]);
    } catch (e) {
      toast.error("Could not record deployment", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setSubmittingUrl(false);
    }
  }

  // ─── Codespaces path ───────────────────────────────────
  function codespacesUrl() {
    if (!githubRepo) return null;
    const cleaned = githubRepo.replace("https://github.com/", "");
    return "https://codespaces.new/" + cleaned;
  }

  // ─── Render by path ────────────────────────────────────

  if (path === "script") {
    return (
      <>
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Configure and generate
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pick a target, add environment variables, and SOJIP writes the
              script.
            </p>
          </div>

          {/* Target picker */}
          <div>
            <Label className="text-xs text-slate-600 mb-2 block">
              Deploy target
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {scriptTargets.map((t) => {
                const meta = TARGET_META[t];
                const isSelected = t === target;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTarget(t)}
                    className={clsx(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition text-left",
                      isSelected
                        ? "border-terracotta-500 bg-terracotta-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                  >
                    <span className="text-lg shrink-0">{meta.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-900 truncate">
                        {meta.label}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {meta.verification}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Env vars */}
          <div>
            <Label className="text-xs text-slate-600 mb-2 block">
              Environment variables
            </Label>
            <EnvVarAddForm pending={pendingEnv} onChange={setPendingEnv} />
          </div>

          {/* Generate */}
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button
              onClick={handleGenerateScript}
              disabled={generatingScript}
            >
              {generatingScript ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Generate deploy script
                </>
              )}
            </Button>
          </div>
        </div>

        <ScriptModal
          open={scriptModalOpen}
          onOpenChange={setScriptModalOpen}
          script={script}
          loading={generatingScript}
        />
      </>
    );
  }

  if (path === "url") {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Paste your deployment URL
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            SOJIP will hit the URL and record the result. HTTP 200-399 =
            healthy.
          </p>
        </div>

        <div>
          <Label className="text-xs text-slate-600 mb-2 block">
            Deployment URL
          </Label>
          <Input
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="https://your-app.example.com"
            className="font-mono text-sm"
          />
        </div>

        <div>
          <Label className="text-xs text-slate-600 mb-2 block">
            Environment variables (optional)
          </Label>
          <EnvVarAddForm pending={pendingEnv} onChange={setPendingEnv} />
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button onClick={handleSubmitUrl} disabled={submittingUrl || !manualUrl}>
            {submittingUrl ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Validating…
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Record and validate
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Codespaces
  const csUrl = codespacesUrl();
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">
          Deploy via Codespaces
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Codespaces runs a dev server in GitHub's cloud and gives you a
          public port-forward URL.
        </p>
      </div>

      {csUrl ? (
        <>
          <a
            href={csUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition"
          >
            <Github className="w-4 h-4" />
            Open in Codespaces
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 leading-relaxed">
            <p className="font-medium text-slate-800 mb-2">
              In the new Codespaces tab:
            </p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Run your dev server (e.g., <code className="font-mono">npm run dev</code>)
              </li>
              <li>Open the PORTS tab in Codespaces</li>
              <li>
                Right-click the port → Port Visibility → Public
              </li>
              <li>Copy the forwarded URL</li>
              <li>Paste it below</li>
            </ol>
          </div>

          <div>
            <Label className="text-xs text-slate-600 mb-2 block">
              Paste the Codespaces URL
            </Label>
            <Input
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="https://your-codespace-8000.app.github.dev"
              className="font-mono text-sm"
            />
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button
              onClick={handleSubmitUrl}
              disabled={submittingUrl || !manualUrl}
            >
              {submittingUrl ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Validating…
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  Record and validate
                </>
              )}
            </Button>
          </div>
        </>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-900">
          No GitHub repository linked to this project. Scaffold a repo first
          to use Codespaces.
        </div>
      )}
    </div>
  );
}
