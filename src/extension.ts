import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import * as vscode from "vscode";

type Pack = "pain" | "sexy" | "halo" | "meme";

const PACKS: Pack[] = ["pain", "sexy", "halo", "meme"];
let lastPlayTime = 0;

function listMp3s(dir: string): string[] {
  try {
    const names = fs.readdirSync(dir);
    return names
      .filter((n: string) => n.toLowerCase().endsWith(".mp3"))
      .map((n: string) => path.join(dir, n));
  } catch {
    return [];
  }
}

function getMp3s(ext: vscode.ExtensionContext, pack: Pack): string[] {
  const mediaDir = path.join(ext.extensionPath, "media", pack);
  let files = listMp3s(mediaDir);
  if (files.length === 0) {
    const audioDir = path.join(ext.extensionPath, "audio", pack);
    files = listMp3s(audioDir);
  }
  return files;
}

function pickRandom(files: string[]): string | null {
  if (files.length === 0) return null;
  return files[Math.floor(Math.random() * files.length)];
}

function playFile(filePath: string, volume: number): void {
  const vol = Math.round(Math.max(0, Math.min(1, volume)) * 100);
  const platform = process.platform;
  let cmd: string;
  if (platform === "darwin") {
    cmd = `afplay ${JSON.stringify(filePath)}`;
  } else if (platform === "win32") {
    cmd = `ffplay -nodisp -autoexit -volume ${vol} ${JSON.stringify(filePath)} 2>nul || mpv --no-video --no-terminal --volume=${vol} ${JSON.stringify(filePath)} 2>nul`;
  } else {
    cmd = `ffplay -nodisp -autoexit -volume ${vol} ${JSON.stringify(filePath)} 2>/dev/null || mpv --no-video --no-terminal --volume=${vol} ${JSON.stringify(filePath)} 2>/dev/null || true`;
  }
  exec(cmd, () => {});
}

function play(ext: vscode.ExtensionContext, pack: Pack, skipCooldown = false): void {
  const cfg = vscode.workspace.getConfiguration("errorOofies");
  if (!skipCooldown && !cfg.get<boolean>("enabled", true)) return;
  if (!skipCooldown) {
    const cooldownMs = cfg.get<number>("cooldownMs", 10);
    if (Date.now() - lastPlayTime < cooldownMs) return;
  }
  const files = getMp3s(ext, pack);
  const file = pickRandom(files);
  if (file) {
    lastPlayTime = Date.now();
    const volume = cfg.get<number>("volume", 0.8);
    playFile(file, volume);
  } else if (skipCooldown) {
    vscode.window.showErrorMessage("Error Oofies: no MP3s in media/ or audio/" + pack + ". Add MP3s to audio/" + pack + ".");
  }
}

function hasErrors(diags: vscode.Diagnostic[]): boolean {
  return diags.some((d) => d.severity === vscode.DiagnosticSeverity.Error);
}

export function activate(context: vscode.ExtensionContext): void {
  const trigger = () => {
    const pack = vscode.workspace.getConfiguration("errorOofies").get<Pack>("soundPack", "pain");
    play(context, pack);
  };

  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics((e) => {
      for (const uri of e.uris) {
        if (hasErrors(vscode.languages.getDiagnostics(uri))) {
          trigger();
          break;
        }
      }
    })
  );

  if (vscode.window.onDidEndTerminalShellExecution) {
    context.subscriptions.push(
      vscode.window.onDidEndTerminalShellExecution((e) => {
        if (e.exitCode !== undefined && e.exitCode !== 0) trigger();
      })
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("errorOofies.playTestSound", () => {
      const pack = vscode.workspace.getConfiguration("errorOofies").get<Pack>("soundPack", "pain");
      play(context, pack, true);
    }),
    vscode.commands.registerCommand("errorOofies.changeSoundPack", async () => {
      const cfg = vscode.workspace.getConfiguration("errorOofies");
      const current = cfg.get<Pack>("soundPack", "pain");
      const chosen = await vscode.window.showQuickPick(PACKS, {
        title: "Error Oofies: Sound pack",
        placeHolder: current,
        canPickMany: false,
      });
      if (chosen) await cfg.update("soundPack", chosen, vscode.ConfigurationTarget.Global);
    })
  );
}

export function deactivate(): void {}
