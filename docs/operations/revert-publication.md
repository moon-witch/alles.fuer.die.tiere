# Veröffentlichung rückgängig machen

## Zweck

Eine falsch veröffentlichte aktuelle Aktion oder ein Projektfakt lässt sich aus dem privaten Verlauf zurücknehmen. Der ursprüngliche Vorgang und seine Belege bleiben erhalten; die Rücknahme erzeugt einen neuen Vorgang.

## Ablauf

1. Unter `/admin/verlauf` den Eintrag der Veröffentlichung öffnen. Auch ein zugehöriger `operation.applied`-Eintrag führt zum gleichen Vorgang.
2. Die Vorschau lesen: Sie zeigt die betroffene Route und die danach sichtbare Aktion oder die Anzahl verbleibender Projektfakten. Bei der ersten Veröffentlichung entsteht eine leere öffentliche Seite beziehungsweise verschwindet die Projektseite aus der öffentlichen Liste.
3. Nur wenn die Vorschau keinen Konflikt meldet, **Rückgängigmachen bestätigen** beziehungsweise **Fakt zurücknehmen bestätigen** wählen.
4. Die öffentliche Route prüfen und im Verlauf den neuen Rücknahme-Vorgang öffnen.

**Erfolg:** Der ursprüngliche Vorgang hat den Status `reverted` und verweist auf den neuen Vorgang. Die neue Aktivität enthält die öffentliche Wirkung; die frühere Aktivität bleibt unverändert.

**Konflikt:** Wenn seit der Vorschau eine neuere Veröffentlichung entstand, bleibt die öffentliche Seite unverändert. Der Versuch erzeugt einen `revert_conflict`-Eintrag unter `/admin/aufgaben`. Die neuere Veröffentlichung prüfen und anschließend eine gezielte Korrektur vorbereiten; nicht die alte Revision erzwingen. Nach der Prüfung den Eintrag mit einer kurzen Notiz erledigen. Diese Erledigung ändert keine öffentliche Seite.

**Unerwarteter Fehler:** Joshua prüft den letzten Vorgang und die Container-Logs in Coolify, bevor ein neuer Versuch mit einer neuen Vorschau erfolgt. Keine Datenbankzeilen manuell löschen oder ältere Revisionszeiger direkt setzen.
