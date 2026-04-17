"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { apiPut } from "@/lib/api";
import type { Course } from "@/lib/types";

function SortableCourseLink({ course, active, collapsed }: { course: Course; active: boolean; collapsed: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: course.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="group flex min-w-0 items-center">
      <Link
        href={`/courses/${course.id}`}
        className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          active
            ? "bg-accent/10 text-accent font-medium"
            : "text-muted hover:bg-surface-hover hover:text-foreground"
        }`}
        title={collapsed ? course.name : undefined}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent/10 text-[10px] font-bold text-accent">
          {course.code?.slice(0, 2) || course.name.slice(0, 2)}
        </span>
        {!collapsed && <span className="truncate">{course.name}</span>}
      </Link>
      {!collapsed && (
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab rounded p-1.5 text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground active:cursor-grabbing"
          title="Drag to reorder"
        >
          <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor">
            <circle cx="2" cy="1.5" r="1" /><circle cx="6" cy="1.5" r="1" />
            <circle cx="2" cy="5" r="1" /><circle cx="6" cy="5" r="1" />
            <circle cx="2" cy="8.5" r="1" /><circle cx="6" cy="8.5" r="1" />
          </svg>
        </button>
      )}
    </div>
  );
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" },
  { href: "/calendar", label: "Calendar", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { href: "/scores", label: "Scores", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { href: "/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [courses, setCourses] = useState<Course[]>([]);
  const [dark, setDark] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));

  useEffect(() => {
    fetch("/api/courses")
      .then((r) => r.json())
      .then((data: Course[]) => setCourses([...data].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999))))
      .catch(() => {});
  }, [pathname]);

  const handleCourseDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = courses.findIndex((c) => c.id === active.id);
    const newIndex = courses.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(courses, oldIndex, newIndex);
    setCourses(reordered.map((c, i) => ({ ...c, order: i })));
    await apiPut("/api/courses/reorder", { orderedIds: reordered.map((c) => c.id) });
  };

  const toggleDark = () => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  };

  return (
    <aside
      className={`flex h-screen flex-col overflow-hidden border-r border-border bg-surface transition-all ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className="flex items-center justify-between p-4">
        {!collapsed && <h1 className="text-lg font-bold tracking-tight">Acads Intel</h1>}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-lg p-1.5 text-muted hover:bg-surface-hover hover:text-foreground"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {collapsed ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
          </svg>
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:bg-surface-hover hover:text-foreground"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d={item.icon} />
              </svg>
              {!collapsed && item.label}
            </Link>
          );
        })}

        <div className="pb-1 pt-4">
          {!collapsed && (
            <div className="flex items-center justify-between px-3 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Courses</span>
            </div>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCourseDragEnd}>
            <SortableContext items={courses.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {courses.map((c) => (
                <SortableCourseLink key={c.id} course={c} active={pathname === `/courses/${c.id}`} collapsed={collapsed} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </nav>

      <div className="border-t border-border p-3">
        <button
          onClick={toggleDark}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          title={collapsed ? (dark ? "Light mode" : "Dark mode") : undefined}
        >
          {dark ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
          {!collapsed && (dark ? "Light mode" : "Dark mode")}
        </button>
      </div>
    </aside>
  );
}
