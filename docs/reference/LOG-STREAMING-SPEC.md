# Log Streaming Spec - Service Admin UI

Repo target: `lasso-@serviceadmin`
Date: 2026-04-11
Status: active design spec for the log streaming page

## Purpose

The Logs page should give operators a clear, performant live log experience for a selected service.

This page is not meant to be:
- a generic textarea dump
- a plain unbounded DOM list
- a fake terminal for its own sake
- a raw transport demo

It is meant to help an operator answer questions like:
- what is this service doing right now?
- what just happened before the current moment?
- are there warnings/errors I should react to?
- can I pause the live stream and inspect backlog cleanly?
- can I jump from logs to the related service/runtime/details surfaces?

## Technology choice

Chosen frontend log viewer component: **`@melloware/react-logviewer`**

Reason:
- actual off-the-shelf log viewer component, not just a low-level primitive
- built for large logs
- supports browser log-viewing use cases better than inventing a custom viewer first
- stronger direct fit than a plain virtualized list when the actual requirement is “show logs to the user”

Chosen browser transport for live logs: **SSE / EventSource**

Reason:
- one-way stream is a good fit for log tailing
- simpler than WebSocket for the first version
- clean reconnection model for a log stream page

## Page role in the product

The Logs page is the **primary live log surface**.

That means:
- Service Details should link into Logs
- Runtime may link into Logs
- Services table may link into Logs
- the full live stream should live here, not be duplicated everywhere else

Service Details may show a small log preview, but not the full stream experience.

## Data model

### Backlog / history

First load should include recent backlog/history for the selected service.

Expected capabilities:
- fetch recent log history
- page backward later if needed
- preserve ordering and timestamps

### Live stream

After loading backlog:
- attach the SSE stream for the selected service
- append new entries into the viewer
- show clear stream state in the UI

### Log event shape

Each log entry should carry at least:
- timestamp
- service id
- level
- source/stream
- message

Preferred optional fields:
- sequence id
- metadata/context object
- trace/request correlation id
- structured tags

## Frontend component behavior

### Core viewer

Use `@melloware/react-logviewer` as the primary log-display component.

It should become the main log pane within the Logs page layout.

### Required surrounding controls

The page should include:
- selected service indicator / selector
- live mode state
- pause / resume
- search/filter input
- log level filter
- log source filter
- jump back to service details

### Viewer expectations

The viewer should support a readable operator experience:
- recent backlog visible immediately
- new entries stream in when live mode is active
- pausing should stop auto-follow behavior without losing loaded entries
- searching/filtering should remain understandable and predictable

## Page composition

The Logs page should have these parts:

1. **Header / page intro**
   - explains this is the primary live log surface
   - includes service context and search/filter controls

2. **Status / stream summary row**
   - selected service
   - stream state
   - whether live mode is active or paused
   - simple count/summary if useful

3. **Main viewer surface**
   - `@melloware/react-logviewer` is the dominant content area
   - should visually read as the main thing on the page

4. **Navigation-out actions**
   - service details
   - runtime view
   - maybe network/config later when useful

## Interaction model

### Required interactions

- select/focus a service
- load recent backlog
- attach live stream
- pause/resume live follow
- search within logs
- filter by level/source
- jump back to Service Details

### Recommended next interactions

- reconnect banner / stream health state
- clear search / reset filters
- download/export logs
- open around a specific timestamp
- pin/highlight warnings and errors

## Visual semantics

### Level styling

Log levels should be visually distinct but not loud to the point of hurting readability.

Recommended first-pass treatment:
- info -> neutral/standard text
- warn -> amber accent
- error -> red/destructive accent

### Source styling

Source labels should be compact badges or metadata markers, for example:
- stdout
- stderr
- app
- supervisor
- healthcheck

### Readability rules

The viewer should prioritize:
- stable line rendering
- readable timestamps
- visible level/source markers
- strong contrast without terminal cosplay unless explicitly wanted later

## Performance rules

The log page must anticipate long-running streams and large buffers.

Guidance:
- do not render an unbounded raw DOM list
- do not use a plain textarea as the main viewer
- let the chosen viewer component handle large-log rendering concerns where possible
- bound retained history in the browser when needed

## Stream state UX

The page should make stream state obvious.

Minimum states:
- connecting
- live
- paused
- disconnected / reconnecting
- error

Operators should not have to guess whether the page is currently following the stream.

## First acceptable implementation target

A good first proper log-streaming version should achieve all of this:
- selected service context is obvious
- recent backlog loads first
- live SSE stream attaches after backlog
- `@melloware/react-logviewer` is the main display component
- pause/resume works clearly
- level/source filtering exists
- service-details jump exists
- stream state is visible

## Explicit non-goals for the first proper version

Not required in the first proper version:
- full terminal emulation
- shell input / bidirectional console
- advanced multi-service log correlation UI
- complex analytics over log history
- every export/search feature imaginable

## Design quality bar

The Logs page should feel:
- like a real operator log viewer
- performant for large/continuous logs
- visually consistent with the rest of the admin UI
- more purposeful than a generic scrolling text area

If it feels like a placeholder or a hacked-together text dump, it is not done.
