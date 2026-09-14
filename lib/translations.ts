import { EXTRA_TRANSLATIONS } from './translations-extra.ts';
import { ITEM_TRANSLATIONS } from './translations-items.ts';
// English source text | Turkish | French | German. User-authored names remain unchanged.
export const TRANSLATIONS: string[][] = `
Choose language|Dil seç|Choisir la langue|Sprache wählen
Close|Kapat|Fermer|Schließen
{0} courses|{0} parkur|{0} parcours|{0} Strecken
{0} stars|{0} yıldız|{0} étoiles|{0} Sterne
Overhead route map of {0}|{0} parkurunun üstten görünümü|Vue du dessus du parcours {0}|Streckenübersicht von {0}
turns, forks, platforms and hazards|virajlar, yol ayrımları, platformlar ve engeller|virages, bifurcations, plateformes et obstacles|Kurven, Abzweigungen, Plattformen und Hindernisse
Play|Oyna|Jouer|Spielen
Find Online Game|Çevrim içi oyun bul|Trouver une partie|Online-Spiel finden
Play with Friends|Arkadaşlarınla oyna|Jouer entre amis|Mit Freunden spielen
Open menu|Menüyü aç|Ouvrir le menu|Menü öffnen
Your cosmic club.|Senin kozmik kulübün.|Votre club cosmique.|Dein kosmischer Club.
Your next adventure starts here|Yeni maceran burada başlıyor|Votre prochaine aventure commence ici|Dein nächstes Abenteuer beginnt hier
Cosmic arcade|Kozmik oyun salonu|Arcade cosmique|Kosmische Spielhalle
Courses|Parkurlar|Parcours|Strecken
Course|Parkur|Parcours|Strecke
Level|Bölüm|Niveau|Level
Course {0}|Parkur {0}|Parcours {0}|Strecke {0}
Course {0} / {1}|Parkur {0} / {1}|Parcours {0} / {1}|Strecke {0} / {1}
Course builder|Parkur tasarımcısı|Éditeur de parcours|Streckeneditor
Star shop & outfits|Yıldız mağazası ve kıyafetler|Boutique et tenues|Sterneshop und Outfits
Your account|Hesabın|Votre compte|Dein Konto
How to play|Nasıl oynanır?|Comment jouer|Spielanleitung
Manage the club|Kulübü yönet|Gérer le club|Club verwalten
Race & audio settings|Yarış ve ses ayarları|Réglages de course et audio|Renn- und Audioeinstellungen
Race mode|Yarış modu|Mode de course|Rennmodus
Quick race|Hızlı yarış|Course rapide|Schnelles Rennen
Championship|Şampiyona|Championnat|Meisterschaft
Music|Müzik|Musique|Musik
Sound|Ses|Son|Ton
on|açık|activé|an
off|kapalı|désactivé|aus
Install game|Oyunu yükle|Installer le jeu|Spiel installieren
Courses, style and everything in between.|Parkurlar, tarzın ve diğer her şey.|Parcours, style et bien plus.|Strecken, Stil und vieles mehr.
Climb higher. Slide faster. Dodge meteors.|Daha yükseğe tırman. Daha hızlı kay. Meteorlardan kaç.|Grimpez, glissez et évitez les météores.|Klettere höher. Rutsche schneller. Weiche Meteoren aus.
Race the|Yarış alanın|À l’assaut du|Erobere den
Cosmos|Kozmos|Cosmos|Kosmos
Tumble Club game|Tumble Club oyunu|Jeu Tumble Club|Tumble Club Spiel
Tumble Club home|Tumble Club ana sayfası|Accueil Tumble Club|Tumble Club Startseite
Pause game|Oyunu duraklat|Mettre en pause|Spiel pausieren
Taking a breather?|Bir mola mı?|Une petite pause ?|Eine kleine Pause?
Your race is paused. Your rivals can wait.|Yarış duraklatıldı. Rakiplerin bekleyebilir.|La course est en pause. Vos rivaux attendront.|Dein Rennen pausiert. Deine Rivalen können warten.
Online races keep running while this menu is open.|Bu menü açıkken çevrim içi yarış devam eder.|La course en ligne continue pendant que ce menu est ouvert.|Online-Rennen laufen weiter, während dieses Menü offen ist.
Back to the race|Yarışa dön|Reprendre la course|Zurück zum Rennen
Back to the chaos|Yarışa dön|Retour dans la mêlée|Zurück ins Getümmel
Restart course|Parkuru yeniden başlat|Recommencer le parcours|Strecke neu starten
Back to lobby|Lobiye dön|Retour au salon|Zurück zur Lobby
Enter fullscreen|Tam ekran|Plein écran|Vollbild
Exit fullscreen|Tam ekrandan çık|Quitter le plein écran|Vollbild verlassen
Reload game|Oyunu yenile|Recharger le jeu|Spiel neu laden
Move|Hareket|Bouger|Bewegen
Jump|Zıpla|Sauter|Springen
Dive|Atıl|Plonger|Hechten
Kick|Tekme|Donner un coup de pied|Treten
Start|Başlangıç|Départ|Start
Finish|Bitiş|Arrivée|Ziel
Time|Süre|Temps|Zeit
Place|Sıra|Place|Platz
Tumbles|Düşüş|Chutes|Stürze
Race to the finish!|Bitişe ulaş!|Foncez vers l’arrivée !|Ab ins Ziel!
150s limit|150 sn sınırı|Limite : 150 s|Zeitlimit: 150 s
Get ready|Hazır ol|Préparez-vous|Bereit machen
Next race in|Yeni yarışa kalan|Prochaine course dans|Nächstes Rennen in
Custom course|Özel parkur|Parcours personnalisé|Eigene Strecke
Cosmic course|Kozmik parkur|Parcours cosmique|Kosmische Strecke
Choose a course|Parkur seç|Choisir un parcours|Strecke wählen
Pick your playground.|Parkurunu seç.|Choisissez votre terrain de jeu.|Wähle deinen Spielplatz.
Finish each course to unlock the next. Every finish earns at least one star.|Sonraki parkuru açmak için önceki parkuru bitir. Her bitiriş en az bir yıldız kazandırır.|Terminez chaque parcours pour débloquer le suivant. Chaque arrivée rapporte au moins une étoile.|Beende jede Strecke, um die nächste freizuschalten. Jeder Abschluss bringt mindestens einen Stern.
Best runs earn stars once. Beat your best to earn more.|En iyi derecen bir kez yıldız kazandırır. Daha fazlası için rekorunu geliştir.|Les meilleurs temps rapportent des étoiles une fois. Battez votre record pour en gagner davantage.|Bestzeiten bringen einmal Sterne. Verbessere deinen Rekord für weitere Sterne.
Main courses · {0} courses · {1}|Ana parkurlar · {0} parkur · {1}|Parcours principaux · {0} parcours · {1}|Hauptstrecken · {0} Strecken · {1}
Locked|Kilitli|Verrouillé|Gesperrt
Ready|Hazır|Prêt|Bereit
Best {0}|En iyi {0}|Record {0}|Bestzeit {0}
of {0} unlocked|/ {0} açıldı|sur {0} débloqués|von {0} freigeschaltet
/ {0} unlocked|/ {0} açıldı|/ {0} débloqués|/ {0} freigeschaltet
Earn stars. Find your style.|Yıldız kazan. Tarzını bul.|Gagnez des étoiles. Trouvez votre style.|Sammle Sterne. Finde deinen Stil.
Next course|Sonraki parkur|Parcours suivant|Nächste Strecke
Race again|Yeniden yarış|Rejouer|Erneut fahren
Let’s go again|Bir daha yarışalım|C’est reparti|Noch eine Runde
Qualified!|Tur atladın!|Qualifié !|Qualifiziert!
So close!|Çok yaklaştın!|Si près du but !|So knapp!
Time’s up!|Süre doldu!|Temps écoulé !|Zeit abgelaufen!
The 150-second clock ran out. Your next run starts fresh.|150 saniye doldu. Yeni yarışta tekrar dene.|Les 150 secondes sont écoulées. Retentez votre chance.|Die 150 Sekunden sind vorbei. Versuche es im nächsten Lauf erneut.
You finished! Waiting for your friends…|Bitirdin! Arkadaşların bekleniyor…|Terminé ! En attente de vos amis…|Geschafft! Warte auf deine Freunde…
Finish earlier solo courses to earn these stars.|Bu yıldızları kazanmak için önceki tek oyunculu parkurları bitir.|Terminez les parcours solo précédents pour gagner ces étoiles.|Beende zuerst die vorherigen Solo-Strecken, um diese Sterne zu verdienen.
The lobby stays together for the next course.|Lobi sonraki parkur için bir arada kalır.|Le salon reste réuni pour le prochain parcours.|Die Lobby bleibt für die nächste Strecke zusammen.
Same room. Same friends. New course.|Aynı oda. Aynı arkadaşlar. Yeni parkur.|Même salon. Mêmes amis. Nouveau parcours.|Gleiche Lobby. Gleiche Freunde. Neue Strecke.
What a finish!|Harika bir bitiriş!|Quelle arrivée !|Was für ein Zieleinlauf!
First class tumble!|Müthiş bir yarış!|Une course de première classe !|Ein erstklassiges Rennen!
Finish line, meet legend.|Bitiş çizgisinde bir efsane.|Une légende franchit la ligne.|Eine Legende überquert die Ziellinie.
The crown is yours!|Taç senin!|La couronne est à vous !|Die Krone gehört dir!
One more go?|Bir yarış daha?|Encore une partie ?|Noch eine Runde?
Championship complete|Şampiyona tamamlandı|Championnat terminé|Meisterschaft abgeschlossen
Championship points|Şampiyona puanı|Points du championnat|Meisterschaftspunkte
Championship · round {0}/{1}|Şampiyona · tur {0}/{1}|Championnat · manche {0}/{1}|Meisterschaft · Runde {0}/{1}
Champion’s lap complete|Şampiyonluk turu tamamlandı|Tour du champion terminé|Championsrunde abgeschlossen
Finish in the top 8 to qualify!|Tur atlamak için ilk 8’e gir!|Terminez dans les 8 premiers !|Erreiche die besten 8!
Finish in the top 8 to continue your championship.|Şampiyonaya devam etmek için ilk 8’e gir.|Terminez dans les 8 premiers pour continuer le championnat.|Komme unter die besten 8, um die Meisterschaft fortzusetzen.
Round|Tur|Manche|Runde
· Round|· Tur|· Manche|· Runde
of|/|sur|von
DNF|Bitiremedi|Non terminé|Nicht beendet
Open path|Düz yol|Voie libre|Freie Strecke
Spin challenge|Dönen kollar|Bras tournants|Drehende Arme
Cosmic climb|Kozmik tırmanış|Ascension cosmique|Kosmischer Aufstieg
Jump across|Atlama geçidi|Sauts entre plateformes|Sprungpassage
Hammer trap|Çekiç tuzağı|Piège à marteaux|Hammerfalle
Meteor shower|Meteor yağmuru|Pluie de météores|Meteorschauer
Gravity slide|Yerçekimi kaydırağı|Glissade gravitationnelle|Schwerkraftrutsche
Orbital drop|Yörünge düşüşü|Chute orbitale|Orbitalsturz
Conveyor dash|Bant koşusu|Course sur tapis|Förderbandlauf
Vanishing tiles|Kaybolan zemin|Dalles éphémères|Verschwindende Platten
Left orbit|Sola yörünge|Orbite à gauche|Linke Umlaufbahn
Right orbit|Sağa yörünge|Orbite à droite|Rechte Umlaufbahn
Risk or cruise|Risk veya rahat rota|Risque ou détente|Risiko oder Umweg
Serpentine|Zikzak|Serpentin|Schlangenlinie
← Shortcut · hard|← Kestirme · zor|← Raccourci · difficile|← Abkürzung · schwer
Detour · easy →|Uzun yol · kolay →|Détour · facile →|Umweg · leicht →
Data vortex|Veri girdabı|Vortex de données|Datenwirbel
Checkpoint|Kontrol noktası|Point de contrôle|Kontrollpunkt
Next sector|Sonraki bölge|Secteur suivant|Nächster Sektor
Cosmic run|Kozmik koşu|Course cosmique|Kosmischer Lauf
Easy|Kolay|Facile|Leicht
Medium|Orta|Moyen|Mittel
Hard|Zor|Difficile|Schwer
Add a section|Bölüm ekle|Ajouter une section|Abschnitt hinzufügen
Course name|Parkur adı|Nom du parcours|Streckenname
New course|Yeni parkur|Nouveau parcours|Neue Strecke
Your route|Rotan|Votre itinéraire|Deine Route
sections|bölüm|sections|Abschnitte
Course sequence|Bölüm sıralaması|Ordre des sections|Abschnittsfolge
Drag sections or use the arrows to change their order. Each section starts at a checkpoint.|Bölümleri sürükleyerek veya oklarla sırala. Her bölüm bir kontrol noktasında başlar.|Faites glisser les sections ou utilisez les flèches. Chaque section commence à un point de contrôle.|Ziehe Abschnitte oder nutze die Pfeile zum Sortieren. Jeder Abschnitt beginnt an einem Kontrollpunkt.
Section {0} type|Bölüm {0} türü|Type de section {0}|Typ von Abschnitt {0}
Section {0} difficulty|Bölüm {0} zorluğu|Difficulté de section {0}|Schwierigkeit von Abschnitt {0}
Move section {0} up|Bölüm {0} yukarı|Monter la section {0}|Abschnitt {0} nach oben
Move section {0} down|Bölüm {0} aşağı|Descendre la section {0}|Abschnitt {0} nach unten
Remove section {0}|Bölüm {0} kaldır|Supprimer la section {0}|Abschnitt {0} entfernen
Obstacles|Engeller|Obstacles|Hindernisse
Obstacle|Engel|Obstacle|Hindernis
Position & layout|Konum ve düzen|Position et disposition|Position und Anordnung
Difficulty changes path width, gap size and obstacle speed. Automatic layouts also add obstacles. Custom layouts keep your exact count and positions.|Zorluk; yol genişliğini, atlama boşluğunu ve engel hızını değiştirir. Otomatik düzende engel sayısı da artar. Özel düzende belirlediğin sayı ve konumlar korunur.|La difficulté modifie la largeur, les écarts et la vitesse des obstacles. Les dispositions automatiques ajoutent aussi des obstacles. Les dispositions personnalisées gardent vos nombres et positions.|Die Schwierigkeit ändert Breite, Sprunglücken und Hindernistempo. Automatische Layouts ergänzen Hindernisse. Eigene Layouts behalten Anzahl und Positionen.
Easy: wide paths · 3.35 m jumps · slower hazards|Kolay: geniş yollar · 3,35 m atlama · yavaş engeller|Facile : voies larges · sauts de 3,35 m · obstacles lents|Leicht: breite Wege · 3,35 m Sprünge · langsame Hindernisse
Medium: paths 2 m narrower · 3.70 m jumps · faster hazards|Orta: düz yollar 2 m daralır · 3,70 m atlama · hızlı engeller|Moyen : voies droites réduites de 2 m · sauts de 3,70 m · obstacles rapides|Mittel: Geraden 2 m schmaler · 3,70 m Sprünge · schnellere Hindernisse
Hard: paths 4 m narrower · 4.05 m jumps · fastest hazards|Zor: düz yollar 4 m daralır · 4,05 m atlama · en hızlı engeller|Difficile : voies droites réduites de 4 m · sauts de 4,05 m · obstacles très rapides|Schwer: Geraden 4 m schmaler · 4,05 m Sprünge · schnellste Hindernisse
Risk · left shortcut|Risk · soldaki kestirme|Risque · raccourci gauche|Risiko · linke Abkürzung
Cruise · right detour|Rahat · sağdaki uzun yol|Détente · détour droit|Entspannt · rechter Umweg
Obstacle positions from start to finish|Başlangıçtan bitişe engel konumları|Positions des obstacles du départ à l’arrivée|Hindernispositionen vom Start bis zum Ziel
Along path (%)|Yol boyunca (%)|Sur le parcours (%)|Entlang des Weges (%)
Across path (%)|Enine konum (%)|Position latérale (%)|Querposition (%)
Across path: −100 left, 0 centre, +100 right. Positions follow curves and the selected fork.|Enine konum: −100 sol, 0 orta, +100 sağ. Konumlar virajı ve seçilen kolu takip eder.|Position latérale : −100 gauche, 0 centre, +100 droite. Les positions suivent les virages et la branche choisie.|Querposition: −100 links, 0 Mitte, +100 rechts. Positionen folgen Kurven und gewählter Abzweigung.
Remove obstacle {0}|Engel {0} kaldır|Supprimer l’obstacle {0}|Hindernis {0} entfernen
Add obstacle|Engel ekle|Ajouter un obstacle|Hindernis hinzufügen
Clear obstacles|Engelleri temizle|Effacer les obstacles|Hindernisse löschen
Use difficulty preset|Zorluk düzenini kullan|Utiliser le préréglage|Schwierigkeitsvorgabe nutzen
Spinning arm|Dönen kol|Bras tournant|Dreharm
Jump barrier|Atlama engeli|Barrière à sauter|Sprunghürde
Hammer|Çekiç|Marteau|Hammer
Meteor|Meteor|Météore|Meteor
Moving bumper|Hareketli tampon|Butoir mobile|Beweglicher Stoßer
Pendulum|Sarkaç|Pendule|Pendel
Pusher|İtici|Poussoir|Schieber
Save course|Parkuru kaydet|Enregistrer le parcours|Strecke speichern
Test run|Deneme yarışı|Essai|Testlauf
My courses|Parkurlarım|Mes parcours|Meine Strecken
Saved courses follow your account.|Kayıtlı parkurlar hesabınla eşitlenir.|Vos parcours enregistrés suivent votre compte.|Gespeicherte Strecken folgen deinem Konto.
Guest courses stay on this device.|Misafir parkurları bu cihazda kalır.|Les parcours invités restent sur cet appareil.|Gaststrecken bleiben auf diesem Gerät.
No saved courses yet. Build a route above and save it.|Henüz kayıtlı parkur yok. Yukarıda bir rota tasarlayıp kaydet.|Aucun parcours enregistré. Créez un itinéraire ci-dessus et enregistrez-le.|Noch keine Strecken gespeichert. Entwirf oben eine Route und speichere sie.
Delete saved course {0}|Kayıtlı parkuru sil: {0}|Supprimer le parcours enregistré {0}|Gespeicherte Strecke {0} löschen
Edit {0}|Düzenle: {0}|Modifier {0}|{0} bearbeiten
Edit|Düzenle|Modifier|Bearbeiten
Add to room|Odaya ekle|Ajouter au salon|Zur Lobby hinzufügen
In room rotation|Oda sıralamasında|Dans la rotation|In der Lobby-Rotation
Create or join a friend room to add your courses to its rotation.|Parkurlarını eklemek için arkadaş odası kur veya bir odaya katıl.|Créez ou rejoignez un salon pour ajouter vos parcours à sa rotation.|Erstelle eine Freundeslobby oder tritt einer bei, um deine Strecken hinzuzufügen.
Add your course to this room so everyone can race it. Solo testing is available outside a room.|Herkesin yarışabilmesi için parkurunu odaya ekle. Odadan çıktığında tek başına deneyebilirsin.|Ajoutez votre parcours au salon pour que tous puissent jouer. Les essais solo sont disponibles hors du salon.|Füge deine Strecke zur Lobby hinzu. Solo-Tests sind außerhalb einer Lobby möglich.
Route preview · white start / gold finish|Rota ön izlemesi · beyaz başlangıç / altın bitiş|Aperçu · départ blanc / arrivée dorée|Routenvorschau · weißer Start / goldenes Ziel
Arrange sections, test your route, and add it to your friend room.|Bölümleri sırala, rotanı dene ve arkadaş odana ekle.|Organisez les sections, testez la route et ajoutez-la au salon.|Ordne Abschnitte an, teste deine Route und füge sie zur Freundeslobby hinzu.
Build your next challenge.|Yeni mücadele alanını tasarla.|Créez votre prochain défi.|Baue deine nächste Herausforderung.
Build your own route and race your friends.|Rotanı tasarla ve arkadaşlarınla yarış.|Créez votre parcours et affrontez vos amis.|Baue deine Route und fordere deine Freunde heraus.
Publish & manage courses|Parkurları yayımla ve yönet|Publier et gérer les parcours|Strecken veröffentlichen und verwalten
Your design studio.|Tasarım stüdyon.|Votre studio de création.|Dein Designstudio.
Design studio|Tasarım stüdyosu|Studio de création|Designstudio
Club owner|Kulüp sahibi|Propriétaire du club|Clubbesitzer
Course designer|Parkur tasarımcısı|Créateur de parcours|Streckendesigner
Course designers|Parkur tasarımcıları|Créateurs de parcours|Streckendesigner
Owner|Sahip|Propriétaire|Besitzer
designer|tasarımcı|créateur|Designer
Create courses for the whole club.|Tüm kulüp için parkurlar tasarla.|Créez des parcours pour tout le club.|Erstelle Strecken für den ganzen Club.
Publish a course release|Parkur paketi yayımla|Publier un lot de parcours|Streckenpaket veröffentlichen
Saved courses join the main course sequence after course 50. Each publication increments the release version: v0.0.1, v0.0.2…|Kayıtlı parkurlar ana sıraya 50. parkurdan sonra eklenir. Her yayım sürümü artırır: v0.0.1, v0.0.2…|Les parcours rejoignent la série principale après le 50e. Chaque publication augmente la version : v0.0.1, v0.0.2…|Gespeicherte Strecken ergänzen die Hauptreihe nach Strecke 50. Jede Veröffentlichung erhöht die Version: v0.0.1, v0.0.2…
Save your designs in the builder, then select up to 16 courses below. Publishing an existing saved course updates its original course number.|Tasarımlarını kaydet, sonra aşağıdan en fazla 16 parkur seç. Daha önce yayımlanan bir parkuru güncellemek numarasını değiştirmez.|Enregistrez vos créations, puis choisissez jusqu’à 16 parcours. Une mise à jour conserve le numéro du parcours.|Speichere deine Entwürfe und wähle unten bis zu 16 Strecken. Aktualisierungen behalten die ursprüngliche Streckennummer.
Select / clear all|Tümünü seç / temizle|Tout sélectionner / effacer|Alle auswählen / abwählen
No saved courses yet. Save a course in the builder first.|Henüz kayıtlı parkur yok. Önce tasarımcıda bir parkur kaydet.|Aucun parcours enregistré. Enregistrez d’abord un parcours dans l’éditeur.|Noch keine gespeicherten Strecken. Speichere zuerst eine im Editor.
New main course|Yeni ana parkur|Nouveau parcours principal|Neue Hauptstrecke
Update existing course|Mevcut parkuru güncelle|Mettre à jour le parcours|Vorhandene Strecke aktualisieren
Release comment|Sürüm açıklaması|Commentaire de version|Versionskommentar
Describe what this release adds in at least one complete sentence.|Bu sürümün neler eklediğini en az bir tam cümleyle anlat.|Décrivez les ajouts de cette version en au moins une phrase complète.|Beschreibe die Ergänzungen dieser Version in mindestens einem vollständigen Satz.
Describe this course in at least one complete sentence.|Bu parkuru en az bir tam cümleyle anlat.|Décrivez ce parcours en au moins une phrase complète.|Beschreibe diese Strecke in mindestens einem vollständigen Satz.
Description ready|Açıklama hazır|Description prête|Beschreibung fertig
Write at least 3 words, 12 characters and end with . ! or ?|En az 3 sözcük ve 12 karakter yaz; . ! veya ? ile bitir.|Écrivez au moins 3 mots, 12 caractères et terminez par . ! ou ?|Schreibe mindestens 3 Wörter und 12 Zeichen; beende mit . ! oder ?
All selected courses and notes publish together. Incomplete descriptions keep this button disabled.|Seçilen tüm parkurlar ve notlar birlikte yayımlanır. Eksik açıklamalar varsa düğme etkinleşmez.|Tous les parcours et commentaires sont publiés ensemble. Les descriptions incomplètes désactivent ce bouton.|Alle gewählten Strecken und Notizen werden gemeinsam veröffentlicht. Unvollständige Beschreibungen deaktivieren diesen Knopf.
Publish {0} course{1}|{0} parkuru yayımla|Publier {0} parcours|{0} Strecken veröffentlichen
Publish {0} course|{0} parkuru yayımla|Publier {0} parcours|{0} Strecke veröffentlichen
Publishing…|Yayımlanıyor…|Publication…|Wird veröffentlicht…
Published courses|Yayımlanan parkurlar|Parcours publiés|Veröffentlichte Strecken
Refresh published courses|Yayımlanan parkurları yenile|Actualiser les parcours publiés|Veröffentlichte Strecken aktualisieren
Your first published course will appear here.|Yayımladığın ilk parkur burada görünecek.|Votre premier parcours publié apparaîtra ici.|Deine erste veröffentlichte Strecke erscheint hier.
Update course {0}: {1}|Parkur {0} güncelle: {1}|Modifier le parcours {0} : {1}|Strecke {0} aktualisieren: {1}
Cancel update|Güncellemeyi iptal et|Annuler la modification|Aktualisierung abbrechen
Edited course preview|Düzenlenen parkur ön izlemesi|Aperçu du parcours modifié|Vorschau der bearbeiteten Strecke
revision|revizyon|révision|Revision
Retire {0}|Yayımdan kaldır: {0}|Retirer {0}|{0} zurückziehen
Designers can publish and retire courses. Only you can manage this permission.|Tasarımcılar parkurları yayımlayabilir ve kaldırabilir. Bu yetkiyi yalnızca sen yönetebilirsin.|Les créateurs peuvent publier et retirer des parcours. Vous seul gérez cette permission.|Designer können Strecken veröffentlichen und zurückziehen. Nur du verwaltest diese Berechtigung.
Find a player|Oyuncu bul|Trouver un joueur|Spieler finden
Username or full account email|Kullanıcı adı veya tam e-posta|Pseudo ou adresse e-mail complète|Benutzername oder vollständige E-Mail
Search|Ara|Rechercher|Suchen
No verified players found. Try their full email address or the start of their username.|Doğrulanmış oyuncu bulunamadı. Tam e-posta adresini veya kullanıcı adının başlangıcını dene.|Aucun joueur vérifié trouvé. Essayez l’e-mail complet ou le début du pseudo.|Keine bestätigten Spieler gefunden. Versuche die vollständige E-Mail oder den Anfang des Benutzernamens.
Make designer|Tasarımcı yap|Nommer créateur|Zum Designer ernennen
Remove access|Yetkiyi kaldır|Retirer l’accès|Zugriff entfernen
Saving…|Kaydediliyor…|Enregistrement…|Wird gespeichert…
Please wait…|Lütfen bekle…|Veuillez patienter…|Bitte warten…
Your player account|Oyuncu hesabın|Votre compte joueur|Dein Spielerkonto
Your player account.|Oyuncu hesabın.|Votre compte joueur.|Dein Spielerkonto.
Save your look and courses across devices.|Görünümünü ve parkurlarını cihazların arasında eşitle.|Retrouvez votre apparence et vos parcours sur tous vos appareils.|Synchronisiere Aussehen und Strecken auf allen Geräten.
Loading your account…|Hesabın yükleniyor…|Chargement du compte…|Dein Konto wird geladen…
Sign in|Giriş yap|Se connecter|Anmelden
Create account|Hesap oluştur|Créer un compte|Konto erstellen
Sign out|Çıkış yap|Se déconnecter|Abmelden
Continue with Google|Google ile devam et|Continuer avec Google|Mit Google fortfahren
Continue with Apple|Apple ile devam et|Continuer avec Apple|Mit Apple fortfahren
Continue with Google to create an account or sign in. Email signup and password-reset emails are not available yet.|Hesap oluşturmak veya giriş yapmak için Google ile devam et. E-posta kaydı ve şifre sıfırlama henüz kullanılamıyor.|Continuez avec Google pour créer un compte ou vous connecter. L’inscription par e-mail et la réinitialisation ne sont pas encore disponibles.|Fahre mit Google fort, um ein Konto zu erstellen oder dich anzumelden. E-Mail-Registrierung und Passwortzurücksetzung sind noch nicht verfügbar.
Email|E-posta|E-mail|E-Mail
Password|Şifre|Mot de passe|Passwort
Your password|Şifren|Votre mot de passe|Dein Passwort
New password|Yeni şifre|Nouveau mot de passe|Neues Passwort
Choose a new password|Yeni bir şifre seç|Choisir un nouveau mot de passe|Neues Passwort wählen
At least 8 characters|En az 8 karakter|Au moins 8 caractères|Mindestens 8 Zeichen
Forgot your password?|Şifreni mi unuttun?|Mot de passe oublié ?|Passwort vergessen?
Send reset link|Sıfırlama bağlantısı gönder|Envoyer le lien|Link zum Zurücksetzen senden
Save new password|Yeni şifreyi kaydet|Enregistrer le nouveau mot de passe|Neues Passwort speichern
Back to sign in|Giriş ekranına dön|Retour à la connexion|Zurück zur Anmeldung
or use email|veya e-posta kullan|ou utiliser un e-mail|oder E-Mail verwenden
Player name|Oyuncu adı|Pseudo|Spielername
Your racer name|Yarışçı adın|Votre pseudo|Dein Rennname
Choose player name|Oyuncu adı seç|Choisir un pseudo|Spielernamen wählen
3–24 letters, numbers, or underscores. Other racers see this name.|3–24 harf, rakam veya alt çizgi. Diğer yarışçılar bu adı görür.|3 à 24 lettres, chiffres ou tirets bas. Les autres joueurs verront ce nom.|3–24 Buchstaben, Ziffern oder Unterstriche. Andere Spieler sehen diesen Namen.
Player name not set|Oyuncu adı belirlenmedi|Pseudo non défini|Spielername fehlt
Save player profile|Oyuncu profilini kaydet|Enregistrer le profil|Spielerprofil speichern
Verified email|Doğrulanmış e-posta|E-mail vérifié|Bestätigte E-Mail
Confirm your email before joining public games.|Herkese açık oyunlara katılmadan önce e-postanı doğrula.|Confirmez votre e-mail avant de rejoindre une partie publique.|Bestätige deine E-Mail, bevor du öffentlichen Spielen beitrittst.
Open star shop & outfits|Yıldız mağazasını aç|Ouvrir la boutique et les tenues|Sterneshop und Outfits öffnen
Your look|Görünümün|Votre apparence|Dein Aussehen
Make your racer yours.|Yarışçına tarzını kat.|Personnalisez votre coureur.|Gestalte deinen Läufer.
Make it yours|Tarzını yansıt|À votre image|Mach es zu deinem
56 ways to make it yours|Tarzın için 56 seçenek|56 façons d’affirmer votre style|56 Möglichkeiten für deinen Stil
Try on 56 wearables. Earn stars to unlock your favorites.|56 aksesuarı dene. Favorilerini açmak için yıldız kazan.|Essayez 56 accessoires. Gagnez des étoiles pour débloquer vos favoris.|Probiere 56 Accessoires an. Sammle Sterne für deine Favoriten.
stars to spend|harcanabilir yıldız|étoiles à dépenser|Sterne zum Ausgeben
stars available|yıldız hazır|étoiles disponibles|Sterne verfügbar
{0} stars available|{0} yıldız hazır|{0} étoiles disponibles|{0} Sterne verfügbar
stars|yıldız|étoiles|Sterne
Complete outfits|Kıyafet setleri|Tenues complètes|Komplette Outfits
matching items|uyumlu parça|articles assortis|passende Teile
Equip outfit|Seti giy|Équiper la tenue|Outfit anlegen
Owned · equipped|Senin · giyildi|Acquis · équipé|Besessen · angelegt
✓ Owned|✓ Senin|✓ Acquis|✓ Besessen
owned|senin|acquis|besessen
Unlock for ★|★ ile aç|Débloquer pour ★|Freischalten für ★
Unlock ★ {0}|★ {0} ile aç|Débloquer ★ {0}|Freischalten ★ {0}
Try it on · {0} stars|Dene · {0} yıldız|Essayer · {0} étoiles|Anprobieren · {0} Sterne
Save outfit to account|Görünümü hesabına kaydet|Enregistrer la tenue|Outfit im Konto speichern
Every outfit has the same speed, jump, and hitbox.|Her kıyafetin hızı, zıplaması ve çarpışma alanı aynıdır.|Toutes les tenues ont la même vitesse, le même saut et la même zone de collision.|Alle Outfits haben dasselbe Tempo, denselben Sprung und dieselbe Kollisionsfläche.
Same speed and hitbox for every outfit.|Tüm kıyafetlerde aynı hız ve çarpışma alanı.|Même vitesse et zone de collision pour chaque tenue.|Gleiches Tempo und gleiche Kollisionsfläche für jedes Outfit.
Body color|Gövde rengi|Couleur du corps|Körperfarbe
Use {0} body color|Gövde rengi: {0}|Utiliser la couleur {0}|Körperfarbe {0} verwenden
Accessory category|Aksesuar kategorisi|Catégorie d’accessoire|Accessoire-Kategorie
Bodies|Gövdeler|Corps|Körper
Body|Gövde|Corps|Körper
Hair & hats|Saç ve şapkalar|Cheveux et chapeaux|Haare und Hüte
Headwear|Baş aksesuarları|Couvre-chefs|Kopfbedeckungen
Eyewear|Gözlükler|Lunettes|Brillen
Back gear|Sırt aksesuarları|Accessoires de dos|Rückenzubehör
Drag to rotate · 360°|Döndürmek için sürükle · 360°|Glisser pour tourner · 360°|Zum Drehen ziehen · 360°
Character preview. Drag to rotate.|Karakter ön izlemesi. Döndürmek için sürükle.|Aperçu du personnage. Glissez pour tourner.|Charaktervorschau. Zum Drehen ziehen.
Rotate character left|Karakteri sola döndür|Tourner à gauche|Charakter nach links drehen
Rotate character right|Karakteri sağa döndür|Tourner à droite|Charakter nach rechts drehen
Coral|Mercan|Corail|Koralle
Lavender|Lavanta|Lavande|Lavendel
Mint|Nane|Menthe|Minze
Sunshine|Güneş|Soleil|Sonnengelb
Pink|Pembe|Rose|Rosa
Sky|Gökyüzü|Ciel|Himmel
blue|mavi|bleu|blau
peach|şeftali|pêche|Pfirsich
purple|mor|violet|lila
yellow|sarı|jaune|gelb
Classic|Klasik|Classique|Klassisch
Tall|Uzun|Grand|Groß
None|Yok|Aucun|Keine
Cap|Kep|Casquette|Kappe
Crown|Taç|Couronne|Krone
Mohawk|Mohikan|Crête|Irokesenschnitt
Glasses|Gözlük|Lunettes|Brille
Sunglasses|Güneş gözlüğü|Lunettes de soleil|Sonnenbrille
Visor|Vizör|Visière|Visier
Space cadet|Uzay öğrencisi|Cadet de l’espace|Weltraumkadett
Moon mage|Ay büyücüsü|Mage lunaire|Mondmagier
Sky bunny|Gökyüzü tavşanı|Lapin céleste|Himmelshase
`
  .trim()
  .split('\n')
  .map((line) => line.split('|'))
  .concat(EXTRA_TRANSLATIONS, ITEM_TRANSLATIONS);
