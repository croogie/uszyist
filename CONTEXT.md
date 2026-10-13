# Daily Task Workflow

A daily workflow for planning tasks, executing them within time blocks, and reflecting on the day. Task queries describe the current Todoist state rather than reconstructing historical task state.

## Language

**Dated task**:
A task assigned to a calendar day, with or without a start time.
_Avoid_: Scheduled task

**Time block**:
An interval assigned to a task, defined by a concrete start time and a positive duration. Its start is inclusive and its end is exclusive.
_Avoid_: Slot

**Time-blocked task**:
A task with a complete time block; a start time without a duration is insufficient.
_Avoid_: Scheduled task

**Task of the day**:
A task designated by the `zadanie-dnia` label, whether or not it has a time block.
_Avoid_: Current task, priority task

**Planning completion**:
The presence of at least one task of the day with a complete time block on the selected day. Title grammar and schedule quality do not determine completion.

**Current tasks**:
All incomplete tasks whose time blocks contain the reference moment. Overlapping blocks do not select a single preferred task.
_Avoid_: Current task

**Next tasks**:
All incomplete tasks sharing the earliest start strictly after the reference moment on the selected day. A duration is not required.
_Avoid_: Next task

**Elapsed-block tasks**:
Incomplete tasks on the selected day whose complete time blocks end at or before the reference moment. This does not establish whether work occurred during those blocks.
_Avoid_: Failed tasks, overdue tasks

**Deadline**:
A task's completion deadline, independent of its assigned calendar day and time block.
_Avoid_: Planned date

**Activity**:
Recorded Todoist events within the selected day, optionally restricted by a lower time boundary. Activity alone does not establish focus or time spent working.
