# Contributing to the Shaderfrog 2.0 Hybrid Graph editor

The editor is open source and uses the MIT license. To contribute to the
editor, submit a pull request to this repository.

## How this repository is maintained

The editor is part of the "open core" of
[Shaderfrog](https://shaderfrog.com/2/). The Shaderfrog website itself is a
closed source project, because it handles user authentication, passwords,
payment, etc. The Shaderfrog website uses this editor as one of its main
components.

The development of the editor is primarily to support the website and its
features, including paid/pro features. Even though the editor is open source,
there will inevitably be site-specific and paid/pro-specific features in this
repository. For example, high res assets show a "(PRO)" annotation in the
editor. This is inevitable due to how this repository is maintained and used.

There may also be site-specific features in the editor that only work in the
context of the Shaderfrog website. If you want to use this open source editor
embedded in your own game/engine/project, there may still be traces of the
Shaderfrog website itself, like hard coded links to Shaderfrog pages,
site-specific user fields like avatars, etc.

Everything in the open source editor is still usable, including paid features
like high res assets. You can stub any data you like, and if you embed the
editor in your own project, you can pass in whatever assets you want as props.

As the maintainer, I may commit breaking changes to the editor without warning,
because these changes need to be deployed in tandem with the core / private
Shaderfrog website repository. Due to the number of features I need to
maintain, and given this is a side / hobby project of mine, the editor is more
of the "wild west" of development, at least right now. As of writing this, the
editor does not have a comprehensive test suite, for example. The editor
features change regularly, and are not yet stabilized, so there may be drastic
changes to the editor in the future, including layout, functionality, and style
changes.

## What types of changes are accepted?

For larger changes, please propose them in an issue first for discussion. As
the maintainer, it's up to my discretion to choose which pull requests to
merge. I want you to avoid the experience of creating a large change that I
then reject. Discussions on Github issues before you create a pull request will
hopefully mitigate this.

Examples of things that are more likely to be accepted
without issue:
- Bug fixes
- Typos
- CSS fixes
- Usability improvements
- Improved compatibility with other libraries (Three.js / R3F / Babylon /
  PlayCanvas etc)
- Clean-up refactors
- Performance improvements
- Dependency version bumps
- Documentation improvements

For features that currently exist, improvements to those features are also more
likely to be accepted. For example, if a configuration pane has some, but not
all, of Three.js available properties (like material properties), adding the
rest of those properties for completeness is more likely to be accepted.

For new feature additions, they are up to my discretion. Whether I merge or not
is largely based in whether or not I think new features should be a fundamental
addition to the Shaderfrog site. There may be features that make sense to add
to your own use of the editor, but may not make sense for the website, and may
lead to me rejecting that change. This is why I encourage you to open a
discussion first, to to see if a new feature or large change makes sense.

## Open core structure

The editor is built on two more mature projects I also maintain:
- The [Shaderfrog GLSL compiler](https://github.com/ShaderFrog/glsl-parser).
- The [Shaderfrog Core](https://github.com/ShaderFrog/core).

Both of these projects have test suites and use SemVer more appropriately. The
GLSL compiler, which is the core library of Shaderfrog, is the most mature of
these three repositories. The core is slightly less mature, but has tests, and
the editor is more loosely developed for now.

