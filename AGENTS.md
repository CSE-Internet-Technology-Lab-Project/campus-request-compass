<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Workflow state changes (request approvals, project allocation) go only through security-definer DB functions (`act_on_request`, `act_on_application`); tables have no UPDATE grants — keeps transitions enforceable server-side.
- Roles live in `user_roles` checked via `has_role`; first signup becomes HOD, later signups are students — HOD promotes others.
- UI uses shadcn/ui components from `src/components/ui` only; don't hand-roll primitives.
