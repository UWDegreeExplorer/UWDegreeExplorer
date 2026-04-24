const fs = require("fs");
const path = require("path");

const homePath = path.resolve(__dirname, "../apps/web/src/pages/home.tsx");
const destPath = path.resolve(__dirname, "../apps/web/src/features/posts/PostDetailPane.tsx");

const content = fs.readFileSync(homePath, "utf8");
const lines = content.split("\n");

// We need to extract CommentNode (811), ReplyComposer (897), PostDetailPane (1028)
// Find indices
const commentNodeStart = lines.findIndex(l => l.startsWith("function CommentNode({"));
const postDetailEnd = lines.findIndex(l => l === "export default function Home() {");

if (commentNodeStart === -1 || postDetailEnd === -1) {
  console.error("Could not find start or end!");
  process.exit(1);
}

// Find the end of PostDetailPane
let actualEnd = postDetailEnd - 1;
while(lines[actualEnd].trim() === "") actualEnd--; // Go up to the closing brace

const extracted = lines.slice(commentNodeStart, actualEnd + 1).join("\n");

const imports = `import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useGetPost, useDeletePost, useGetCurrentUser, useCreateComment, useCustomMutation, customFetch, getGetPostQueryKey, getGetRecentActivityQueryKey, getGetSectionStatsQueryKey, getListPostsQueryKey, type Comment, type Section } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { relTime } from "@/lib/utils";
import { SECTION_LABELS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserCircle2, Loader2, Bookmark, Trash2, MessageCircle, Reply, Send } from "lucide-react";

`;

fs.writeFileSync(destPath, imports + extracted + "\n");
console.log("Wrote extracted content to", destPath);

// Now remove from home.tsx and add import
const before = lines.slice(0, commentNodeStart);
const after = lines.slice(actualEnd + 1);

// Insert import at the top
const importLine = `import { PostDetailPane } from "../features/posts/PostDetailPane";`;
let newHomeLines = [];

for (let i = 0; i < before.length; i++) {
  newHomeLines.push(before[i]);
  if (before[i].startsWith(`import { WelcomePane }`)) {
    newHomeLines.push(importLine);
  }
}

fs.writeFileSync(homePath, newHomeLines.concat(after).join("\n"));
console.log("Updated home.tsx");
