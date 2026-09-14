/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/** Event name for Long Animation Frames API entries. */
export const LONG_ANIMATION_FRAME_EVENT_NAME = 'browser.long_animation_frame';

/** Name reported by the long-animation-frame performance entry. */
export const ATTR_LONG_ANIMATION_FRAME_NAME =
  'browser.long_animation_frame.name';

/** Performance entry type, normally `long-animation-frame`. */
export const ATTR_LONG_ANIMATION_FRAME_ENTRY_TYPE =
  'browser.long_animation_frame.entry_type';

/** Total duration of the frame in milliseconds. */
export const ATTR_LONG_ANIMATION_FRAME_DURATION =
  'browser.long_animation_frame.duration';

/** Total time in milliseconds during which the main thread was blocked. */
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
