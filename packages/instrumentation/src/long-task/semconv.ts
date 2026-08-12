/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/** Event name for Long Tasks API entries. */
export const LONG_TASK_EVENT_NAME = 'browser.long_task';

/** Name reported by the long-task performance entry. */
export const ATTR_LONG_TASK_NAME = 'browser.long_task.name';

/** Performance entry type, normally `longtask`. */
export const ATTR_LONG_TASK_ENTRY_TYPE = 'browser.long_task.entry_type';

/** Total duration of the task in milliseconds. */
export const ATTR_LONG_TASK_DURATION = 'browser.long_task.duration';

/** Structured attribution entries reported for the task. */
export const ATTR_LONG_TASK_ATTRIBUTION = 'browser.long_task.attribution';
