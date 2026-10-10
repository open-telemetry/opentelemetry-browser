/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/** Event name for Long Animation Frames API entries. */
export const LONG_ANIMATION_FRAME_EVENT_NAME = 'browser.long_animation_frame';

/** Start time of the frame in milliseconds relative to the time origin. */
export const ATTR_LONG_ANIMATION_FRAME_START_TIME =
  'browser.long_animation_frame.start_time';

/** Total duration of the frame in milliseconds. */
export const ATTR_LONG_ANIMATION_FRAME_DURATION =
  'browser.long_animation_frame.duration';

/**
 * Time in milliseconds the main thread was blocked from responding to
 * high-priority tasks: the sum, over the tasks in the frame that ran longer than
 * 50 ms, of each task's duration minus 50 ms, with the rendering time added to
 * the longest of them. It is not the frame's total blocked time and it is not
 * distributed across the `scripts` entries.
 * https://w3c.github.io/long-animation-frames/#dom-performancelonganimationframetiming-blockingduration
 */
export const ATTR_LONG_ANIMATION_FRAME_BLOCKING_DURATION =
  'browser.long_animation_frame.blocking_duration';

/** Start time of the rendering cycle in milliseconds relative to time origin. */
export const ATTR_LONG_ANIMATION_FRAME_RENDER_START =
  'browser.long_animation_frame.render_start';

/** Start time of the style and layout cycle in milliseconds relative to time origin. */
export const ATTR_LONG_ANIMATION_FRAME_STYLE_AND_LAYOUT_START =
  'browser.long_animation_frame.style_and_layout_start';

/** Time of the first UI event processed during the frame, in milliseconds relative to time origin. */
export const ATTR_LONG_ANIMATION_FRAME_FIRST_UI_EVENT_TIMESTAMP =
  'browser.long_animation_frame.first_ui_event_timestamp';

/** Structured script timing entries reported for the frame. */
export const ATTR_LONG_ANIMATION_FRAME_SCRIPTS =
  'browser.long_animation_frame.scripts';
