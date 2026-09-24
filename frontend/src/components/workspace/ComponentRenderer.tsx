"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  type: string;
  props: Record<string, unknown>;
}

/**
 * Renders a single workspace component using Shadcn primitives.
 * Called from both the canvas and the standalone preview.
 */
export function ComponentRenderer({ type, props }: Props) {
  switch (type) {
    // ─── Typography ──────────────────────────────────────
    case "heading": {
      const level = Number(props.level || 1);
      const text = String(props.text || "Heading");
      const cls =
        level === 1
          ? "text-3xl font-bold tracking-tight"
          : level === 2
          ? "text-2xl font-semibold tracking-tight"
          : level === 3
          ? "text-xl font-semibold"
          : "text-lg font-medium";
      const Tag = ("h" + Math.min(Math.max(level, 1), 4)) as "h1";
      return <Tag className={cls}>{text}</Tag>;
    }

    case "text": {
      const size = String(props.size || "base");
      const cls =
        size === "sm" ? "text-sm text-slate-700"
        : size === "lg" ? "text-lg text-slate-700"
        : "text-base text-slate-700";
      return <p className={cls}>{String(props.text || "")}</p>;
    }

    case "label":
      return (
        <Label className="text-sm font-medium">
          {String(props.text || "Label")}
        </Label>
      );

    case "separator":
      return <Separator className="my-2" />;

    // ─── Buttons ─────────────────────────────────────────
    case "button": {
      const variant = String(props.variant || "default") as
        | "default"
        | "secondary"
        | "outline"
        | "ghost"
        | "destructive"
        | "link";
      const size = String(props.size || "default") as
        | "sm"
        | "default"
        | "lg"
        | "icon";
      return (
        <Button variant={variant} size={size}>
          {String(props.text || "Button")}
        </Button>
      );
    }

    // ─── Inputs ──────────────────────────────────────────
    case "input":
      return (
        <Input
          placeholder={String(props.placeholder || "")}
          type={String(props.type || "text")}
        />
      );

    case "textarea":
      return (
        <Textarea
          placeholder={String(props.placeholder || "")}
          rows={Number(props.rows || 4)}
        />
      );

    // ─── Display ─────────────────────────────────────────
    case "badge": {
      const variant = String(props.variant || "default") as
        | "default"
        | "secondary"
        | "outline"
        | "destructive";
      return <Badge variant={variant}>{String(props.text || "Badge")}</Badge>;
    }

    case "card":
      return (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{String(props.title || "Card title")}</CardTitle>
            {!!props.description && (
              <CardDescription>{String(props.description)}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">{String(props.body || "")}</p>
          </CardContent>
        </Card>
      );

    case "progress":
      return (
        <div className="w-full max-w-md">
          <Progress value={Number(props.value || 0)} />
        </div>
      );

    case "skeleton":
      return (
        <Skeleton
          className="rounded"
          style={{
            width: Number(props.width || 240) + "px",
            height: Number(props.height || 16) + "px",
          }}
        />
      );

    // ─── Containers ──────────────────────────────────────
    case "tabs": {
      const labels = String(props.tabs || "Tab 1, Tab 2")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (labels.length === 0) labels.push("Tab 1");
      return (
        <Tabs defaultValue={labels[0]} className="w-full max-w-md">
          <TabsList>
            {labels.map((l) => (
              <TabsTrigger key={l} value={l}>
                {l}
              </TabsTrigger>
            ))}
          </TabsList>
          {labels.map((l) => (
            <TabsContent key={l} value={l}>
              <p className="text-sm text-slate-600">Content for {l}</p>
            </TabsContent>
          ))}
        </Tabs>
      );
    }

    case "dialog":
      return (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">
              {String(props.trigger || "Open dialog")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{String(props.title || "Dialog")}</DialogTitle>
              <DialogDescription>{String(props.body || "")}</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

    case "dropdown-menu": {
      const items = String(props.items || "Item 1, Item 2")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              {String(props.trigger || "Options")}
              <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {items.map((item, i) => (
              <DropdownMenuItem key={i}>{item}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    default:
      return (
        <div className="rounded border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-400">
          Unknown component: {type}
        </div>
      );
  }
}
