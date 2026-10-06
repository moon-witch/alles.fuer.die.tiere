# Öffentliche Quelle erfassen

## Zweck

Die Quellenbox unter `/admin/quellen` sichert eine öffentliche Originalantwort privat und verbindet sie mit einem Faktenentwurf. Ein Entwurf ändert die Website nicht.

## Voraussetzung

Der Web-Ressource in Coolify sind `S3_ENDPOINT`, `S3_BUCKET_RAW=raw`, `S3_ACCESS_KEY` und `S3_SECRET_KEY` gesetzt. Der Bucket `raw` existiert und ist privat. `S3_REGION` kann auf `eu-central-1` bleiben. Die früheren Variablennamen `S3_BUCKET`, `S3_ACCESS_KEY_ID` und `S3_SECRET_ACCESS_KEY` werden ebenfalls akzeptiert. Der Endpunkt ist die interne SeaweedFS-S3-Adresse; rohe Snapshots erhalten keine öffentliche URL. Die Bucket-Namen als Umgebungsvariablen anzulegen erstellt die Buckets nicht automatisch.

## Ablauf

1. Das Projekt unter `/admin/inhalte` anlegen, falls es noch nicht existiert.
2. Unter `/admin/quellen` **Raw-Bucket prüfen** wählen. Die Prüfung ist lesend und legt keinen Bucket an. Bei `missing` den Bucket `raw` in SeaweedFS anlegen; bei `forbidden` Zugangsdaten und Rechte prüfen.
3. Die offizielle HTTPS-Adresse, Herausgeber, genaue Belegstelle, vorgeschlagene Aussage sowie Rechte- und Sensibilitätshinweis eintragen. Social-Posts nur als Link in einem redaktionellen Entwurf behandeln; diese Box archiviert sie nicht.
4. **Quelle privat sichern und Entwurf anlegen** wählen. Bei Erfolg öffnet sich der private Faktenentwurf mit der Belegstelle. Dort Wortlaut und Originalquelle prüfen; erst dann separat veröffentlichen.
5. Unter `/admin/verlauf` den `source.observed`-Eintrag bei Bedarf aufrufen. Er enthält Quelllauf, Snapshothash und Vorgangs-ID.

**Erfolg:** Der Quelllauf ist `success`, ein privater Snapshot und ein privater Fakt sind verknüpft, und `/projekte` bleibt bis zur ausdrücklichen Veröffentlichung unverändert.

**Fehler:** Unter `/admin/aufgaben` erscheint ein Hinweis; der Quelllauf ist `failed`. Bei HTTP 403/429 ist die Quelle pausiert. Joshua prüft URL, Quellantwort, S3-Verbindung und die Container-Logs, bevor er mit neuer Anfragekennung erneut erfasst. Fehlgeschlagene Erfassung nicht durch manuelles Setzen eines Snapshothashs ersetzen.
