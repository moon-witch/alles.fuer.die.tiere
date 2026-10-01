# Fixed Development Decisions

1. **Operator:** Joshua operates the site during development and the surprise pilot. Future operating ownership can change after Malte has seen and adopted the project.

2. **Infrastructure:** Deploy to a new dedicated Frankfurt server with Ubuntu, 2 GB RAM, and 40 TB storage. Joshua’s existing Coolify instance handles deployments and configuration. Joshua provisions separate web, worker, PostgreSQL, MCP, and self-hosted SeaweedFS resources. The application uses Coolify internal connections; migrations are versioned application code; Coolify scheduled jobs send encrypted database backups to SeaweedFS S3.

3. **Accounts:** Joshua has the technical steward account. Malte receives one full-content chat account and can create, edit, replace, schedule, publish, unpublish, and archive all public content. Additional accounts are a future option.

4. **Current action:** `/jetzt` always reflects the same action promoted in Malte’s Instagram bio at that time. During the surprise phase, Joshua checks the public bio link and aligns it manually; no Instagram login, API, or scraping is required.

5. **Sources:** V1 polls public websites. Joshua researches and implements the public-web mechanisms for Tierbrücke and Notpfote independently; no written source approval, partner integration, or direct input from Malte, Phia, or management is needed before the surprise.

6. **Public media:** Public-source assets may be hosted or embedded where it makes sense for the project. Every reuse carries clear original credit/source.

7. **Operational dashboard:** Joshua has a separate private dashboard for users, alerts, technical monitoring, source health, and system maintenance. Malte sees only the chat and plain-language problem boxes that direct him to Joshua.

8. **OpenAI:** The API key will be supplied during development. The monthly cap is **€50**.

9. **International domain:** `allfortheanimals.earth` redirects to the German domain for now.

10. **Identity:** The site should immediately feel like an adopted Malte project, using the relevant identity and public assets with credit.

11. **Reveal:** Deploy the finished release as production behind one temporary hardcoded-password screen. It is removed by Joshua after the reveal and is not an account or security feature.

12. **Recovery scope:** Multi-server backups are a future addition, not a V1 requirement. V1 uses encrypted backups in SeaweedFS and verified local restore drills.

13. **Retention:** Keep source-run metadata and activity for the life of the platform; raw public-source bodies for 24 months; rejected draft payloads for 90 days; no private uploads in V1; and encrypted database backups for 30 daily, 12 monthly, and 2 yearly restore points. SeaweedFS lifecycle rules perform and log deletion.

14. **Admin login:** Joshua and Malte sign in with passwords only. An authenticator app and TOTP secret are not required.
