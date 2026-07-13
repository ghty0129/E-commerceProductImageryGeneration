# Domain Glossary

## Product facts

Information about a product that the user has confirmed as true, such as material, dimensions, color, package contents, or intended use. Product facts are authoritative and must not be contradicted by planning or image-generation prompts.

## Product fact card

The reviewed record produced from free-form descriptions, structured fields, and reference images. It separates confirmed facts, unconfirmed inferences, missing information, and contradictions. Only confirmed facts may be treated as product facts.

## Creation mode

The rule set used to plan and generate a project. The supported modes are Amazon compliance, universal platform, free creation, and image-set reconstruction. A mode determines platform constraints but does not own product facts or visual style.

## Amazon compliance mode

The existing Amazon Listing and A+ workflow. It applies Amazon-specific slots, dimensions, copy guidance, and compliance restrictions.

## Universal platform mode

A platform-neutral commerce workflow that produces product copy and a configurable image plan without requiring Amazon titles, five bullet points, or Amazon image slots.

## Free creation mode

A user-directed workflow in which image count, purpose, aspect ratio, text, owned logo, watermark, composition, and style are configurable. It retains safety rules and product truth but does not load Amazon-specific restrictions.

## Image-set reconstruction

A workflow that extracts the marketing purpose of each image in a reference set and creates a newly designed set using the user's product facts and assets. By default, output images correspond one-to-one with the source set's image count and marketing purposes. An explicit replan option allows AI to choose a different count and structure.

## Reconstruction intensity

The requested degree of visual departure from a reference set: light, standard, or deep-original. Standard is the default. This is a creative control, not a guarantee of non-infringement.

## Similarity risk review

A non-legal review that flags possible reuse of third-party logos, wording, composition, people, packaging, or other highly similar elements. Its results are low risk, manual review, or high risk; it is not an infringement certification.

## Global requirement

A user instruction applied to every image in the current project or batch.

## Per-image requirement

A user instruction applied only to one planned image. It overrides default visual-style guidance for that image but cannot override safety rules, product facts, or hard constraints of the selected platform mode.

## Prompt compiler

The component that combines safety and platform rules, user requirements, product facts, image purpose, composition, visual style, series consistency, technical parameters, and exclusions into the final image-generation prompt using explicit precedence.

## Project

One product's inputs, product fact card, selected creation mode, plans, generated images, prompt history, and risk report. A batch workspace can operate on multiple projects.

## Project slot

One selectable position in the batch workspace. Each slot contains exactly one project and has an independent lifecycle and progress state.

