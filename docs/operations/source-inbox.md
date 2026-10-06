# Öffentliche Quelle erfassen

## Zweck

Die Quellenbox unter `/admin/quellen` sichert eine öffentliche Originalantwort privat und verbindet sie mit einem Faktenentwurf. Ein Entwurf ändert die Website nicht.

## Voraussetzung

Der Web-Ressource in Coolify sind `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` und `S3_SECRET_ACCESS_KEY` gesetzt. Der Bucket existiert und ist privat. `S3_REGION` kann auf `us-east-1` bleiben. Der Endpunkt ist die interne SeaweedFS-S3-Adresse; rohe Snapshots erhalten keine öffentliche URL.

## Ablauf

1. Das Projekt unter `/admin/inhalte` anlegen, falls es noch nicht existiert.
2. Unter `/admin/quellen` die offizielle HTTPS-Adresse, Herausgeber, genaue Belegstelle, vorgeschlagene Aussage sowie Rechte- und Sensibilitätshinweis eintragen. Social-Posts nur als Link in einem redaktionellen Entwurf behandeln; diese Box archiviert sie nicht.
3. **Quelle privat sichern und Entwurf anlegen** wählen. Bei Erfolg öffnet sich der private Faktenentwurf mit der Belegstelle. Dort Wortlaut und Originalquelle prüfen; erst dann separat veröffentlichen.
4. Unter `/admin/verlauf` den `source.observed`-Eintrag bei Bedarf aufrufen. Er enthält Quelllauf, Snapshothash und Vorgangs-ID.

**Erfolg:** Der Quelllauf ist `success`, ein privater Snapshot und ein privater Fakt sind verknüpft, und `/projekte` bleibt bis zur ausdrücklichen Veröffentlichung unverändert.

**Fehler:** Unter `/admin/aufgaben` erscheint ein Hinweis; der Quelllauf ist `failed`. Bei HTTP 403/429 ist die Quelle pausiert. Joshua prüft URL, Quellantwort, S3-Verbindung und die Container-Logs, bevor er mit neuer Anfragekennung erneut erfasst. Fehlgeschlagene Erfassung nicht durch manuelles Setzen eines Snapshothashs ersetzen.
