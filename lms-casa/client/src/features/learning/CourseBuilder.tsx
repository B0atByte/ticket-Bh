import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Film, GripVertical, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { confirmDanger } from '../../lib/confirm';
import { LessonContentDialog } from './LessonContentDialog';
import {
  createLesson,
  createModule,
  deleteLesson,
  deleteModule,
  reorderLessons,
  reorderModules,
  updateLesson,
  updateModule,
  type CourseDetail,
  type CourseModule,
  type LessonSummary,
} from './learning.api';

interface Props {
  course: CourseDetail;
}

export function CourseBuilder({ course }: Props) {
  const queryClient = useQueryClient();
  const [modules, setModules] = useState<CourseModule[]>(course.modules);

  useEffect(() => {
    setModules(course.modules);
  }, [course.modules]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['course', course.id] });

  const moduleReorder = useMutation({
    mutationFn: (orderedIds: string[]) => reorderModules(course.id, orderedIds),
    onSuccess: () => void invalidate(),
  });
  const lessonReorder = useMutation({
    mutationFn: (vars: { moduleId: string; orderedIds: string[] }) =>
      reorderLessons(vars.moduleId, vars.orderedIds),
    onSuccess: () => void invalidate(),
  });
  const moduleCreate = useMutation({
    mutationFn: (title: string) => createModule(course.id, { title }),
    onSuccess: () => void invalidate(),
  });
  const moduleUpdate = useMutation({
    mutationFn: (vars: { id: string; title: string }) =>
      updateModule(vars.id, { title: vars.title }),
    onSuccess: () => void invalidate(),
  });
  const moduleDelete = useMutation({
    mutationFn: (id: string) => deleteModule(id),
    onSuccess: () => void invalidate(),
  });
  const lessonCreate = useMutation({
    mutationFn: (vars: { moduleId: string; title: string }) =>
      createLesson(vars.moduleId, { title: vars.title }),
    onSuccess: () => void invalidate(),
  });
  const lessonUpdate = useMutation({
    mutationFn: (vars: { id: string; title: string }) =>
      updateLesson(vars.id, { title: vars.title }),
    onSuccess: () => void invalidate(),
  });
  const lessonDelete = useMutation({
    mutationFn: (id: string) => deleteLesson(id),
    onSuccess: () => void invalidate(),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const busy =
    moduleReorder.isPending ||
    lessonReorder.isPending ||
    moduleCreate.isPending ||
    moduleUpdate.isPending ||
    moduleDelete.isPending ||
    lessonCreate.isPending ||
    lessonUpdate.isPending ||
    lessonDelete.isPending;

  const handleModuleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = modules.findIndex((m) => m.id === active.id);
    const newIdx = modules.findIndex((m) => m.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(modules, oldIdx, newIdx);
    setModules(next);
    moduleReorder.mutate(next.map((m) => m.id));
  };

  const handleLessonDragEnd = (moduleId: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;
    const oldIdx = mod.lessons.findIndex((l) => l.id === active.id);
    const newIdx = mod.lessons.findIndex((l) => l.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const nextLessons = arrayMove(mod.lessons, oldIdx, newIdx);
    setModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, lessons: nextLessons } : m)),
    );
    lessonReorder.mutate({ moduleId, orderedIds: nextLessons.map((l) => l.id) });
  };

  const onAddModule = () => {
    const title = window.prompt('ชื่อบทเรียน');
    if (!title?.trim()) return;
    moduleCreate.mutate(title.trim());
  };

  const onEditModule = (mod: CourseModule) => {
    const title = window.prompt('ชื่อบทเรียน', mod.title);
    if (!title?.trim() || title === mod.title) return;
    moduleUpdate.mutate({ id: mod.id, title: title.trim() });
  };

  const onDeleteModule = async (mod: CourseModule) => {
    if (!await confirmDanger('ลบบทเรียน?', `ลบ <b>${mod.title}</b> และหัวข้อทั้งหมดในนั้น?`)) return;
    moduleDelete.mutate(mod.id);
  };

  const onAddLesson = (mod: CourseModule) => {
    const title = window.prompt(`ชื่อหัวข้อใหม่ใน "${mod.title}"`);
    if (!title?.trim()) return;
    lessonCreate.mutate({ moduleId: mod.id, title: title.trim() });
  };

  const onEditLesson = (lesson: LessonSummary) => {
    const title = window.prompt('ชื่อหัวข้อ', lesson.title);
    if (!title?.trim() || title === lesson.title) return;
    lessonUpdate.mutate({ id: lesson.id, title: title.trim() });
  };

  const onDeleteLesson = async (lesson: LessonSummary) => {
    if (!await confirmDanger('ลบหัวข้อ?', `ลบ <b>${lesson.title}</b> ออกจากระบบ?`)) return;
    lessonDelete.mutate(lesson.id);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          ลากที่จับเพื่อจัดเรียง — กดปุ่มแก้ไข/ลบเพื่อจัดการ — การเปลี่ยนแปลงจะบันทึกอัตโนมัติ
        </p>
        <div className="flex items-center gap-2">
          {busy && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              กำลังบันทึก…
            </span>
          )}
          <Button type="button" onClick={onAddModule} disabled={busy}>
            <Plus className="h-4 w-4" />
            เพิ่มบทเรียน
          </Button>
        </div>
      </div>

      {modules.length === 0 ? (
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          ยังไม่มีบทเรียน — กด <strong>เพิ่มบทเรียน</strong> เพื่อเริ่ม
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
          <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            {modules.map((mod) => (
              <SortableModule
                key={mod.id}
                module={mod}
                onEdit={() => onEditModule(mod)}
                onDelete={() => onDeleteModule(mod)}
                onAddLesson={() => onAddLesson(mod)}
                onEditLesson={onEditLesson}
                onDeleteLesson={onDeleteLesson}
                onLessonDragEnd={handleLessonDragEnd(mod.id)}
                sensors={sensors}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableModule({
  module: mod,
  onEdit,
  onDelete,
  onAddLesson,
  onEditLesson,
  onDeleteLesson,
  onLessonDragEnd,
  sensors,
}: {
  module: CourseModule;
  onEdit: () => void;
  onDelete: () => void;
  onAddLesson: () => void;
  onEditLesson: (lesson: LessonSummary) => void;
  onDeleteLesson: (lesson: LessonSummary) => void;
  onLessonDragEnd: (event: DragEndEvent) => void;
  sensors: ReturnType<typeof useSensors>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: mod.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border bg-card p-4"
      aria-label={`Module ${mod.title}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab rounded p-1 text-muted-foreground hover:bg-accent active:cursor-grabbing"
          aria-label={`Drag handle for module ${mod.title}`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <h3 className="flex-1 font-semibold">{mod.title}</h3>
        <span className="text-xs text-muted-foreground">ลำดับ {mod.orderIndex}</span>
        <Button
          type="button"
          variant="ghost"
          onClick={onEdit}
          className="h-8 w-8 px-0"
          aria-label={`Edit ${mod.title}`}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onDelete}
          className="h-8 w-8 px-0 text-destructive hover:bg-destructive/10"
          aria-label={`Delete ${mod.title}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 pl-7">
        {mod.lessons.length === 0 ? (
          <p className="text-xs text-muted-foreground">ยังไม่มีหัวข้อ</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onLessonDragEnd}>
            <SortableContext
              items={mod.lessons.map((l) => l.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-2">
                {mod.lessons.map((lesson) => (
                  <SortableLesson
                    key={lesson.id}
                    lesson={lesson}
                    onEdit={() => onEditLesson(lesson)}
                    onDelete={() => onDeleteLesson(lesson)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={onAddLesson}
          className="mt-2 h-8 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          เพิ่มหัวข้อ
        </Button>
      </div>
    </div>
  );
}

function SortableLesson({
  lesson,
  onEdit,
  onDelete,
}: {
  lesson: LessonSummary;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab rounded p-1 text-muted-foreground hover:bg-accent active:cursor-grabbing"
        aria-label={`Drag handle for lesson ${lesson.title}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1">{lesson.title}</span>
      <span className="text-xs text-muted-foreground">ลำดับ {lesson.orderIndex}</span>
      <LessonContentDialog
        lessonId={lesson.id}
        lessonTitle={lesson.title}
        trigger={
          <Button
            type="button"
            variant="ghost"
            className="h-7 w-7 px-0"
            aria-label={`Manage content of ${lesson.title}`}
            title="Manage content (video/PDF/etc.)"
          >
            <Film className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <Button
        type="button"
        variant="ghost"
        onClick={onEdit}
        className="h-7 w-7 px-0"
        aria-label={`Edit ${lesson.title}`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={onDelete}
        className="h-7 w-7 px-0 text-destructive hover:bg-destructive/10"
        aria-label={`Delete ${lesson.title}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}
