import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { FileSearch, Home } from "lucide-react";

import { TreasureChestIcon } from "@/components/MysteryIcons";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { listFeedbackSummaries, stringsOf } from "@/lib/db";

function takeaway(narrative: string | null, covered: unknown, gaps: unknown) {
  const clean = narrative?.trim();
  if (clean) return clean.length > 112 ? `${clean.slice(0, 109).trimEnd()}…` : clean;
  const gap = stringsOf(gaps)[0];
  if (gap) return `Review: ${gap}`;
  const topic = stringsOf(covered)[0];
  return topic ? `Covered well: ${topic}` : "Feedback report ready.";
}

export function FeedbackSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (router) => router.location.pathname });
  const reports = useQuery({ queryKey: ["feedback-summaries"], queryFn: listFeedbackSummaries });

  const closeMobile = () => setOpenMobile(false);

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <Link to="/" onClick={closeMobile} className="flex min-h-9 items-center gap-2 overflow-hidden">
          <FileSearch className="size-5 shrink-0 text-sidebar-primary" />
          {!collapsed && <span className="text-lg font-bold">Case Summaries</span>}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/"} tooltip="All notebooks">
                  <Link to="/" onClick={closeMobile}>
                    <Home />
                    <span>All notebooks</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="pt-0">
          <SidebarGroupLabel className="label-caps px-2">Session feedback</SidebarGroupLabel>
          <SidebarGroupContent>
            {reports.isPending && !collapsed && (
              <p className="px-2 py-3 text-sm text-sidebar-foreground/65">Opening case notes…</p>
            )}
            {reports.data?.length === 0 && !collapsed && (
              <p className="px-2 py-3 text-sm leading-snug text-sidebar-foreground/65">
                Completed session summaries will appear here.
              </p>
            )}
            <SidebarMenu className="gap-1.5">
              {reports.data?.map((report) => {
                const session = report.sessions;
                if (!session) return null;
                const active = pathname === `/session/${session.id}`;
                return (
                  <SidebarMenuItem key={report.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      size={collapsed ? "default" : "lg"}
                      tooltip={session.title}
                      className="h-auto min-h-12 items-start py-2"
                    >
                      <Link
                        to="/session/$sessionId"
                        params={{ sessionId: session.id }}
                        search={{ view: "feedback" }}
                        onClick={closeMobile}
                      >
                        <TreasureChestIcon className="mt-0.5 size-4 shrink-0" />
                        <span className="min-w-0 whitespace-normal">
                          <span className="block truncate font-semibold">{session.title}</span>
                          <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-sidebar-foreground/65">
                            {takeaway(report.narrative, report.covered, report.gaps)}
                          </span>
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}