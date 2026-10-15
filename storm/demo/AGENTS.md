# Demo UI conventions

- Keep the UI split into small, focused components. Keep orchestration components small as features grow.
- Components controlling one player must share its controller through `NoisedControllerProvider`. Use the context consumer hook in child components; instantiate controller state only in the provider.
