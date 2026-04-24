const fs = require("fs");
const path = require("path");

const homePath = path.resolve(__dirname, "../apps/web/src/pages/home.tsx");
const content = fs.readFileSync(homePath, "utf8");

// Use Regex to find the blocks
const headerRegex = /function Header\([\s\S]*?(?=function SectionRail)/;
const sectionRailRegex = /function SectionRail\([\s\S]*?(?=function PostList)/;
const postListRegex = /function PostList\([\s\S]*?(?=export default function Home)/;

const headerMatch = content.match(headerRegex);
const sectionRailMatch = content.match(sectionRailRegex);
const postListMatch = content.match(postListRegex);

if (!headerMatch || !sectionRailMatch || !postListMatch) {
  console.error("Failed to match blocks!");
  process.exit(1);
}

let headerCode = headerMatch[0];
let sectionRailCode = sectionRailMatch[0];
let postListCode = postListMatch[0];

// Make them exported
headerCode = headerCode.replace("function Header(", "export function Header(");
sectionRailCode = sectionRailCode.replace("function SectionRail(", "export function SectionRail(");
postListCode = postListCode.replace("function PostList(", "export function PostList(");
postListCode = postListCode.replace("function EmptyState(", "export function EmptyState(");

// Create Navigation Features
const navDir = path.resolve(__dirname, "../apps/web/src/features/navigation");
if (!fs.existsSync(navDir)) fs.mkdirSync(navDir, { recursive: true });

const headerImports = `import { useLocation } from "wouter";
import { useGetCurrentUser, useLogoutUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, LogOut, Settings, Menu } from "lucide-react";
import { type SectionFilter } from "@/lib/constants";

`;
fs.writeFileSync(path.join(navDir, "Header.tsx"), headerImports + headerCode);

const railImports = `import { useGetCurrentUser, useGetSectionStats, useCustomFetch, type Section } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeftOpen, PencilLine, Home as HomeIcon, Layers, User as UserIcon, FileText, Bookmark, FileEdit, Inbox as InboxIcon } from "lucide-react";
import { type SectionFilter, SECTION_LABELS, SECTION_ICONS } from "@/lib/constants";

`;
fs.writeFileSync(path.join(navDir, "SectionRail.tsx"), railImports + sectionRailCode);

// Create Posts Feature
const postListImports = `import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useGetCurrentUser, useListPosts, useCustomFetch, useCustomMutation, type Section, getGetSectionStatsQueryKey, getGetRecentActivityQueryKey, getListPostsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, Filter, ArrowUpDown, Loader2, FileEdit, Trash2, MessageSquare, Bookmark as BookmarkIcon, Layers } from "lucide-react";
import { type SectionFilter, SECTION_LABELS } from "@/lib/constants";
import { relTime, excerpt } from "@/lib/utils";
import { ReplyComposer } from "./PostDetailPane";

`;
fs.writeFileSync(path.resolve(__dirname, "../apps/web/src/features/posts/PostList.tsx"), postListImports + postListCode);

// Modify home.tsx
let newHomeContent = content.replace(headerMatch[0], "");
newHomeContent = newHomeContent.replace(sectionRailMatch[0], "");
newHomeContent = newHomeContent.replace(postListMatch[0], "");

const homeImportsToAdd = `import { Header } from "../features/navigation/Header";
import { SectionRail } from "../features/navigation/SectionRail";
import { PostList } from "../features/posts/PostList";\n`;

// Insert after the other feature imports
newHomeContent = newHomeContent.replace(
  `import { PostDetailPane, ReplyComposer } from "../features/posts/PostDetailPane";`,
  `import { PostDetailPane, ReplyComposer } from "../features/posts/PostDetailPane";\n` + homeImportsToAdd
);

fs.writeFileSync(homePath, newHomeContent);
console.log("Extraction complete!");
