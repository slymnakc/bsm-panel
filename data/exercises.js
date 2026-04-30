(function () {
  "use strict";
  function titleCase(value) {
    return String(value)
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
const exerciseGroups = [
  {
    id: "chest",
    exercises: [
      { name: "Barbell bench press", equipment: "barbell", kind: "compound", level: "intermediate", tags: ["shoulder-caution"], cue: "Kürek kemiklerini sabitleyin, barı göğse kontrollü indirin." },
      { name: "Incline dumbbell press", equipment: "dumbbell", kind: "compound", level: "intermediate", tags: ["shoulder-caution"], cue: "Dirsekleri çok açmadan üst göğüs hattına itin." },
      { name: "Chest press machine", equipment: "machine", kind: "compound", level: "beginner", tags: ["beginner-safe"], cue: "Sırt pediyle temas korunsun, bilekleri düz tutun." },
      { name: "Pec deck fly", equipment: "machine", kind: "accessory", level: "beginner", tags: ["shoulder-caution"], cue: "Göğsü sıkıştırın, omuzları öne düşürmeyin." },
      { name: "Cable crossover", equipment: "cable", kind: "accessory", level: "intermediate", tags: [], cue: "Kolları hafif kırık tutup hareketi göğüsle kapatın." },
      { name: "Dumbbell fly", equipment: "dumbbell", kind: "accessory", level: "intermediate", tags: ["shoulder-caution"], cue: "Hareket aralığını omuz konforuna göre sınırlayın." },
      { name: "Push-up", equipment: "bodyweight", kind: "compound", level: "beginner", tags: ["low-impact"], cue: "Gövdeyi tek parça tutun, dirsekleri kontrollü bükün." },
      { name: "Incline machine press", equipment: "machine", kind: "compound", level: "beginner", tags: ["beginner-safe"], cue: "Koltuğu üst göğüs hizasına ayarlayın." },
      { name: "Chest focused dip", equipment: "bodyweight", kind: "compound", level: "advanced", tags: ["shoulder-caution"], cue: "Gövdeyi hafif öne alıp omuz konforunu koruyun." },
      { name: "Smith machine bench press", equipment: "smith", kind: "compound", level: "beginner", tags: ["shoulder-caution"], cue: "Bar yolunu göğüs ortasına hizalayın." },
      { name: "Low-to-high cable fly", equipment: "cable", kind: "accessory", level: "intermediate", tags: [], cue: "Kolları alttan üste kapatıp üst göğsü sıkıştırın." },
      { name: "Machine fly neutral grip", equipment: "machine", kind: "accessory", level: "beginner", tags: ["beginner-safe"], cue: "Dirsek açısını sabit tutarak kontrollü kapanın." },
    ],
  },
  {
    id: "back",
    exercises: [
      { name: "Lat pulldown", equipment: "cable", kind: "compound", level: "beginner", tags: ["beginner-safe"], cue: "Barı göğüs üstüne çekin, ense arkasına indirmeyin." },
      { name: "Assisted pull-up", equipment: "machine", kind: "compound", level: "beginner", tags: [], cue: "Omuzları kulaktan uzaklaştırıp göğsü bara yaklaştırın." },
      { name: "Pull-up", equipment: "bodyweight", kind: "compound", level: "advanced", tags: [], cue: "Tam asılı pozisyondan kontrollü çekiş yapın." },
      { name: "Seated cable row", equipment: "cable", kind: "compound", level: "beginner", tags: ["beginner-safe"], cue: "Dirsekleri geriye sürün, belden savrulmayın." },
      { name: "Chest-supported row", equipment: "machine", kind: "compound", level: "beginner", tags: ["back-friendly"], cue: "Göğüs desteğini koruyarak sırtı sıkıştırın." },
      { name: "Barbell row", equipment: "barbell", kind: "compound", level: "advanced", tags: ["back-caution"], cue: "Kalça menteşesini sabit tutun, belden çekmeyin." },
      { name: "T-bar row", equipment: "barbell", kind: "compound", level: "intermediate", tags: ["back-caution"], cue: "Göğsü açık tutup dirsekleri vücuda yakın çekin." },
      { name: "One-arm dumbbell row", equipment: "dumbbell", kind: "compound", level: "intermediate", tags: [], cue: "Omuzu öne düşürmeden dirseği kalçaya doğru çekin." },
      { name: "Straight-arm pulldown", equipment: "cable", kind: "accessory", level: "beginner", tags: ["shoulder-caution"], cue: "Kolları uzun tutup kanadı aşağı bastırın." },
      { name: "Machine row", equipment: "machine", kind: "compound", level: "beginner", tags: ["beginner-safe"], cue: "Tutacakları gövdeye doğru çekip kürekleri birleştirin." },
      { name: "Face pull", equipment: "cable", kind: "accessory", level: "beginner", tags: ["shoulder-friendly"], cue: "İpi yüz hizasına çekip arka omuzu sıkıştırın." },
      { name: "Back extension", equipment: "machine", kind: "accessory", level: "intermediate", tags: ["back-caution"], cue: "Aşırı hiperekstansiyon yapmadan kalçayla yükselin." },
    ],
  },
  {
    id: "shoulders",
    exercises: [
      { name: "Shoulder press machine", equipment: "machine", kind: "compound", level: "beginner", tags: ["shoulder-caution"], cue: "Koltuğu ayarlayın, dirsekleri çok geriye kaçırmayın." },
      { name: "Dumbbell shoulder press", equipment: "dumbbell", kind: "compound", level: "intermediate", tags: ["shoulder-caution"], cue: "Kaburgayı açmadan baş üstüne kontrollü itin." },
      { name: "Barbell overhead press", equipment: "barbell", kind: "compound", level: "advanced", tags: ["shoulder-caution", "back-caution"], cue: "Karın sıkı, bar yolu dik ve kontrollü olsun." },
      { name: "Dumbbell lateral raise", equipment: "dumbbell", kind: "accessory", level: "beginner", tags: [], cue: "Dirsekleri hafif kırık tutup omuz hizasına kaldırın." },
      { name: "Cable lateral raise", equipment: "cable", kind: "accessory", level: "intermediate", tags: [], cue: "Kablo direncini yan omuzda hissedin, gövdeyle savurmayın." },
      { name: "Rear delt fly machine", equipment: "machine", kind: "accessory", level: "beginner", tags: ["shoulder-friendly"], cue: "Kürekleri sıkıştırmadan arka omuzu izole edin." },
      { name: "Cable face pull", equipment: "cable", kind: "accessory", level: "beginner", tags: ["shoulder-friendly"], cue: "Dirsekleri dışa açıp ipi göz hizasına çekin." },
      { name: "Arnold press", equipment: "dumbbell", kind: "compound", level: "intermediate", tags: ["shoulder-caution"], cue: "Rotasyonu kontrollü yapın, ağrı varsa tercih etmeyin." },
      { name: "Plate front raise", equipment: "barbell", kind: "accessory", level: "beginner", tags: ["shoulder-caution"], cue: "Plakayı omuz hizasını çok geçirmeden kaldırın." },
      { name: "Upright row", equipment: "barbell", kind: "accessory", level: "advanced", tags: ["shoulder-caution"], cue: "Tutuşu genişletin, omuz sıkışması olursa bırakın." },
    ],
  },
  {
    id: "biceps",
    exercises: [
      { name: "Barbell curl", equipment: "barbell", kind: "accessory", level: "beginner", tags: [], cue: "Dirsekleri sabit tutun, belden sallanmayın." },
      { name: "Dumbbell curl", equipment: "dumbbell", kind: "accessory", level: "beginner", tags: [], cue: "Avuçları yukarı çevirerek tam sıkıştırma yapın." },
      { name: "Incline dumbbell curl", equipment: "dumbbell", kind: "accessory", level: "intermediate", tags: [], cue: "Omuzu geride tutup biceps’i uzun pozisyonda çalıştırın." },
      { name: "Hammer curl", equipment: "dumbbell", kind: "accessory", level: "beginner", tags: [], cue: "Nötr tutuşla ön kol ve brachialis’i çalıştırın." },
      { name: "Cable curl", equipment: "cable", kind: "accessory", level: "beginner", tags: ["beginner-safe"], cue: "Kablonun sabit direncini koruyarak kontrollü kaldırın." },
      { name: "Preacher curl", equipment: "machine", kind: "accessory", level: "intermediate", tags: [], cue: "Dirseği pede sabitleyin, en altta kontrolü kaybetmeyin." },
      { name: "Machine curl", equipment: "machine", kind: "accessory", level: "beginner", tags: ["beginner-safe"], cue: "Makine eksenini dirsek hizasına ayarlayın." },
      { name: "Concentration curl", equipment: "dumbbell", kind: "accessory", level: "intermediate", tags: [], cue: "Tek kolda zirve sıkışmaya odaklanın." },
      { name: "Spider curl", equipment: "dumbbell", kind: "accessory", level: "intermediate", tags: [], cue: "Göğüs destekli pozisyonda momentum kullanmayın." },
      { name: "Reverse curl", equipment: "barbell", kind: "accessory", level: "intermediate", tags: [], cue: "Bilekleri düz tutup ön kolu da çalıştırın." },
    ],
  },
  {
    id: "triceps",
    exercises: [
      { name: "Rope pushdown", equipment: "cable", kind: "accessory", level: "beginner", tags: ["beginner-safe"], cue: "Dirsekleri gövde yanında sabitleyin, ipi aşağı açın." },
      { name: "Cable overhead triceps extension", equipment: "cable", kind: "accessory", level: "intermediate", tags: ["shoulder-caution"], cue: "Dirsekleri önde sabit tutup uzun başı çalıştırın." },
      { name: "EZ-bar skull crusher", equipment: "barbell", kind: "accessory", level: "intermediate", tags: ["shoulder-caution"], cue: "Barı alına değil baş arkasına kontrollü indirin." },
      { name: "Close-grip bench press", equipment: "barbell", kind: "compound", level: "intermediate", tags: ["shoulder-caution"], cue: "Tutuşu omuz genişliğinde tutun, dirsekleri içeri alın." },
      { name: "Assisted dip", equipment: "machine", kind: "compound", level: "beginner", tags: ["shoulder-caution"], cue: "Omuz konforuna göre derinliği sınırlayın." },
      { name: "Machine triceps dip", equipment: "machine", kind: "compound", level: "beginner", tags: ["beginner-safe"], cue: "Omuzları aşağıda tutup dirsekleri kilitlemeden itin." },
      { name: "Dumbbell kickback", equipment: "dumbbell", kind: "accessory", level: "beginner", tags: [], cue: "Üst kolu sabit tutup sadece dirseği açın." },
      { name: "Cross-body cable extension", equipment: "cable", kind: "accessory", level: "intermediate", tags: [], cue: "Tek kol çalışıp triceps’i son noktada sıkın." },
      { name: "EZ-bar french press", equipment: "barbell", kind: "accessory", level: "intermediate", tags: ["shoulder-caution"], cue: "Dirsekleri çok açmadan kontrollü uzatın." },
      { name: "Single-arm cable pushdown", equipment: "cable", kind: "accessory", level: "beginner", tags: ["beginner-safe"], cue: "Tek taraflı farkları azaltmak için kontrollü uygulayın." },
    ],
  },
  {
    id: "quadriceps",
    exercises: [
      { name: "Leg press", equipment: "machine", kind: "compound", level: "beginner", tags: ["knee-caution"], cue: "Dizleri içe düşürmeyin, bel pediyle temas korunsun." },
      { name: "Hack squat", equipment: "machine", kind: "compound", level: "intermediate", tags: ["knee-caution"], cue: "Ayak yerleşimini üyeye göre ayarlayın, derinliği kontrollü artırın." },
      { name: "Smith machine squat", equipment: "smith", kind: "compound", level: "beginner", tags: ["knee-caution"], cue: "Ayakları hafif öne alın, gövdeyi dik tutun." },
      { name: "Goblet squat", equipment: "dumbbell", kind: "compound", level: "beginner", tags: ["knee-caution"], cue: "Dambılı göğüs önünde tutup dizleri ayak yönünde takip ettirin." },
      { name: "Barbell back squat", equipment: "barbell", kind: "compound", level: "advanced", tags: ["knee-caution", "back-caution"], cue: "Brace alın, omurga nötr ve ayak basışı dengeli olsun." },
      { name: "Bulgarian split squat", equipment: "dumbbell", kind: "compound", level: "advanced", tags: ["knee-caution"], cue: "Ön diz kontrolünü koruyun, ağrı varsa step-up tercih edin." },
      { name: "Leg extension", equipment: "machine", kind: "accessory", level: "beginner", tags: ["knee-caution"], cue: "Diz eksenini makine eksenine hizalayın." },
      { name: "Walking lunge", equipment: "dumbbell", kind: "compound", level: "intermediate", tags: ["knee-caution"], cue: "Adımı kontrollü atın, dizin içe kaçmasına izin vermeyin." },
      { name: "Step-up", equipment: "dumbbell", kind: "accessory", level: "beginner", tags: ["knee-caution"], cue: "Basamak yüksekliğini diz konforuna göre seçin." },
      { name: "Sissy squat machine", equipment: "machine", kind: "accessory", level: "advanced", tags: ["knee-caution"], cue: "Sadece diz sağlığı uygun üyelerde kontrollü kullanın." },
    ],
  },
  {
    id: "hamstrings",
    exercises: [
      { name: "Romanian deadlift", equipment: "barbell", kind: "compound", level: "intermediate", tags: ["back-caution"], cue: "Kalçayı geriye itin, sırtı nötr tutun." },
      { name: "Dumbbell Romanian deadlift", equipment: "dumbbell", kind: "compound", level: "beginner", tags: ["back-caution"], cue: "Dambılları bacaklara yakın indirip hamstring gerilimini hissedin." },
      { name: "Lying leg curl", equipment: "machine", kind: "accessory", level: "beginner", tags: ["beginner-safe"], cue: "Kalçayı pedden kaldırmadan topuğu kalçaya çekin." },
      { name: "Seated leg curl", equipment: "machine", kind: "accessory", level: "beginner", tags: ["beginner-safe"], cue: "Bacağın arkasını tam sıkıştırıp kontrollü bırakın." },
      { name: "Good morning", equipment: "barbell", kind: "compound", level: "advanced", tags: ["back-caution"], cue: "Yükü hafif tutun, kalça menteşesi tekniği şart." },
      { name: "Single-leg dumbbell RDL", equipment: "dumbbell", kind: "accessory", level: "intermediate", tags: ["back-caution"], cue: "Kalçayı kare tutup dengeyi koruyun." },
      { name: "Cable pull-through", equipment: "cable", kind: "accessory", level: "beginner", tags: ["back-friendly"], cue: "Kabloyu bacak arasından geçirip kalçayla kilitleyin." },
      { name: "Glute-ham raise", equipment: "machine", kind: "compound", level: "advanced", tags: [], cue: "Eksantrik inişi yavaş tutun, hamstring kontrolünü koruyun." },
    ],
  },
  {
    id: "glutes",
    exercises: [
      { name: "Barbell hip thrust", equipment: "barbell", kind: "compound", level: "intermediate", tags: ["back-friendly"], cue: "Çeneyi hafif içeri alın, zirvede kalçayı sıkın." },
      { name: "Machine hip thrust", equipment: "machine", kind: "compound", level: "beginner", tags: ["beginner-safe", "back-friendly"], cue: "Ped yerleşimini kalça kıvrımına göre ayarlayın." },
      { name: "Glute bridge", equipment: "mat", kind: "accessory", level: "beginner", tags: ["low-impact", "back-friendly"], cue: "Belden değil kalçadan yükselin." },
      { name: "Cable kickback", equipment: "cable", kind: "accessory", level: "beginner", tags: ["low-impact"], cue: "Bel boşluğunu artırmadan topuğu geriye itin." },
      { name: "Abductor machine", equipment: "machine", kind: "accessory", level: "beginner", tags: ["beginner-safe"], cue: "Gövdeyi sabit tutup dış kalçayı sıkın." },
      { name: "Sumo deadlift", equipment: "barbell", kind: "compound", level: "advanced", tags: ["back-caution"], cue: "Dizleri ayak yönünde açın, barı vücuda yakın tutun." },
      { name: "Kettlebell swing", equipment: "kettlebell", kind: "conditioning", level: "advanced", tags: ["back-caution"], cue: "Squat değil kalça menteşesiyle patlayıcı uzanın." },
      { name: "Reverse lunge", equipment: "dumbbell", kind: "compound", level: "intermediate", tags: ["knee-caution"], cue: "Geri adım diz stresini azaltır, gövde kontrolünü koruyun." },
      { name: "Frog pump", equipment: "mat", kind: "accessory", level: "beginner", tags: ["low-impact"], cue: "Ayak tabanlarını birleştirip kısa aralıkta kalçayı sıkın." },
      { name: "Step-up glute focus", equipment: "dumbbell", kind: "accessory", level: "intermediate", tags: ["knee-caution"], cue: "Öne eğimi hafif artırıp kalçadan itin." },
    ],
  },
  {
    id: "calves",
    exercises: [
      { name: "Standing calf raise machine", equipment: "machine", kind: "accessory", level: "beginner", tags: ["beginner-safe"], cue: "En altta esneyip en üstte baldırı sıkın." },
      { name: "Seated calf raise", equipment: "machine", kind: "accessory", level: "beginner", tags: ["beginner-safe"], cue: "Soleus için kontrollü ve tam hareket aralığı kullanın." },
      { name: "Leg press calf raise", equipment: "machine", kind: "accessory", level: "beginner", tags: [], cue: "Dizleri kilitlemeden ayak bileğinden itin." },
      { name: "Single-leg calf raise", equipment: "bodyweight", kind: "accessory", level: "beginner", tags: ["low-impact"], cue: "Tek taraflı denge ve tam sıkışma hedefleyin." },
      { name: "Donkey calf raise", equipment: "machine", kind: "accessory", level: "intermediate", tags: [], cue: "Kalçadan sabitlenip baldırı tam uzatın." },
      { name: "Tibialis raise", equipment: "bodyweight", kind: "accessory", level: "beginner", tags: ["low-impact"], cue: "Ayak uçlarını yukarı çekip ön kavalı çalıştırın." },
      { name: "Farmer walk on toes", equipment: "dumbbell", kind: "conditioning", level: "intermediate", tags: ["low-impact"], cue: "Parmak ucunda kısa mesafe yürüyüp gövdeyi dik tutun." },
      { name: "Smith machine calf raise", equipment: "smith", kind: "accessory", level: "beginner", tags: [], cue: "Barı kontrollü taşıyın, ayak bileğinden çalışın." },
    ],
  },
  {
    id: "core",
    exercises: [
      { name: "Plank", equipment: "mat", kind: "core", level: "beginner", tags: ["low-impact", "back-friendly"], cue: "Kaburgayı kapatın, bel çukurunu büyütmeyin." },
      { name: "Side plank", equipment: "mat", kind: "core", level: "beginner", tags: ["low-impact", "back-friendly"], cue: "Omuz-dirsek hizasını koruyup kalçayı düşürmeyin." },
      { name: "Dead bug", equipment: "mat", kind: "core", level: "beginner", tags: ["low-impact", "back-friendly"], cue: "Bel boşluğunu sabit tutarak çapraz uzanın." },
      { name: "Bird dog", equipment: "mat", kind: "core", level: "beginner", tags: ["low-impact", "back-friendly"], cue: "Kalça ve omuzları yere paralel tutun." },
      { name: "Hanging knee raise", equipment: "bodyweight", kind: "core", level: "intermediate", tags: ["shoulder-caution"], cue: "Sallanmayı azaltıp dizleri kontrollü çekin." },
      { name: "Cable crunch", equipment: "cable", kind: "core", level: "intermediate", tags: [], cue: "Kalçayı sabit tutup gövdeyi kaburgadan kapatın." },
      { name: "Cable wood chop", equipment: "cable", kind: "core", level: "intermediate", tags: ["back-caution"], cue: "Rotasyonu kontrollü yapın, belden savrulmayın." },
      { name: "Pallof press", equipment: "cable", kind: "core", level: "beginner", tags: ["low-impact", "back-friendly"], cue: "Kabloya direnip gövdeyi döndürmeden itin." },
      { name: "Ab wheel rollout", equipment: "mat", kind: "core", level: "advanced", tags: ["back-caution"], cue: "Bel sarkmadan küçük aralıkla başlayın." },
      { name: "Reverse crunch", equipment: "mat", kind: "core", level: "beginner", tags: ["low-impact"], cue: "Kalçayı kontrollü kaldırıp karını sıkın." },
      { name: "Mountain climber", equipment: "bodyweight", kind: "conditioning", level: "intermediate", tags: ["high-impact"], cue: "Omuz hattını koruyup dizleri ritimli çekin." },
      { name: "Captain chair leg raise", equipment: "machine", kind: "core", level: "intermediate", tags: [], cue: "Sırt desteğini kullanıp kalçayı hafif yukarı yuvarlayın." },
    ],
  },
  {
    id: "cardio",
    exercises: [
      { name: "Incline treadmill walk", equipment: "cardio", kind: "cardio", level: "beginner", tags: ["low-impact"], cue: "Eğim ve hızı konuşabilecek tempo aralığında ayarlayın." },
      { name: "Stationary bike", equipment: "cardio", kind: "cardio", level: "beginner", tags: ["low-impact", "knee-friendly"], cue: "Sele yüksekliğini diz hafif kırık kalacak şekilde ayarlayın." },
      { name: "Elliptical", equipment: "cardio", kind: "cardio", level: "beginner", tags: ["low-impact"], cue: "Omuzları rahat tutup ritmi sabit koruyun." },
      { name: "Rowing ergometer", equipment: "cardio", kind: "cardio", level: "intermediate", tags: ["back-caution"], cue: "Bacak, gövde, kol sırasını koruyun." },
      { name: "Stair climber", equipment: "cardio", kind: "cardio", level: "intermediate", tags: ["knee-caution"], cue: "Tutacaklara asılmadan kontrollü tırmanın." },
      { name: "Battle rope intervals", equipment: "sled", kind: "conditioning", level: "intermediate", tags: ["shoulder-caution"], cue: "Dizler yumuşak, gövde sabit ve ritim net olsun." },
      { name: "Sled push", equipment: "sled", kind: "conditioning", level: "intermediate", tags: ["low-impact"], cue: "Gövdeyi eğimli tutup güçlü kısa adımlar kullanın." },
      { name: "Air bike", equipment: "cardio", kind: "cardio", level: "intermediate", tags: ["low-impact"], cue: "Kol ve bacak ritmini birlikte kullanın." },
      { name: "Jump rope", equipment: "bodyweight", kind: "conditioning", level: "intermediate", tags: ["high-impact", "knee-caution"], cue: "Kısa sıçrama, yumuşak iniş ve bilekten çevirme hedefleyin." },
      { name: "Brisk walking circuit", equipment: "bodyweight", kind: "cardio", level: "beginner", tags: ["low-impact"], cue: "Dinlenme günlerinde düşük tempolu aktif toparlanma olarak kullanın." },
    ],
  },
  {
    id: "mobility",
    exercises: [
      { name: "Thoracic rotation", equipment: "mat", kind: "mobility", level: "beginner", tags: ["low-impact"], cue: "Göğüs kafesini kontrollü döndürüp belden savrulmayın." },
      { name: "Hip flexor stretch", equipment: "mat", kind: "mobility", level: "beginner", tags: ["low-impact"], cue: "Kalçayı hafif içeri alın, bel boşluğunu artırmayın." },
      { name: "Hamstring stretch", equipment: "mat", kind: "mobility", level: "beginner", tags: ["low-impact"], cue: "Dizi kilitlemeden arka bacakta gerilim hissedin." },
      { name: "Couch stretch", equipment: "mat", kind: "mobility", level: "intermediate", tags: ["knee-caution"], cue: "Diz altını yumuşak destekle koruyun." },
      { name: "Band shoulder dislocate", equipment: "band", kind: "mobility", level: "beginner", tags: ["shoulder-caution"], cue: "Geniş tutuşla ağrısız hareket aralığı kullanın." },
      { name: "Wall slide", equipment: "bodyweight", kind: "mobility", level: "beginner", tags: ["shoulder-friendly"], cue: "Bel boşluğu artmadan kolları duvarda kaydırın." },
      { name: "Ankle mobility drill", equipment: "bodyweight", kind: "mobility", level: "beginner", tags: ["low-impact"], cue: "Topuğu kaldırmadan dizinizi ayak ucuna yönlendirin." },
      { name: "Cat-camel", equipment: "mat", kind: "mobility", level: "beginner", tags: ["back-friendly", "low-impact"], cue: "Omurgayı nazikçe yuvarlayıp açın." },
      { name: "World's greatest stretch", equipment: "mat", kind: "mobility", level: "intermediate", tags: ["low-impact"], cue: "Kalça, hamstring ve torasik rotasyonu aynı akışta açın." },
      { name: "Foam roller lat release", equipment: "mat", kind: "mobility", level: "beginner", tags: ["low-impact"], cue: "Ağrılı baskı yerine rahatlatıcı basınç kullanın." },
    ],
  },
];

const exerciseExpansionBlueprints = {
  chest: {
    families: [
      "Bench press",
      "Incline press",
      "Decline press",
      "Chest fly",
      "Cable fly",
      "Push-up",
      "Machine press",
      "Squeeze press",
      "Dip",
      "Landmine chest press",
    ],
    variants: ["barbell", "dumbbell", "machine", "cable", "smith", "tempo"],
    familyVariants: {
      "Bench press": ["barbell", "dumbbell", "smith", "pause rep", "tempo", "close grip"],
      "Incline press": ["barbell", "dumbbell", "machine", "smith", "tempo", "neutral grip"],
      "Decline press": ["barbell", "dumbbell", "machine", "smith", "tempo", "pause rep"],
      "Chest fly": ["dumbbell", "machine", "cable", "incline dumbbell", "decline dumbbell", "tempo"],
      "Cable fly": ["standing", "low-to-high", "high-to-low", "single-arm", "kneeling", "seated"],
      "Push-up": ["incline", "decline", "tempo", "close grip", "weighted", "band resisted"],
      "Machine press": ["seated", "iso-lateral", "plate loaded", "neutral grip", "tempo", "single arm"],
      "Squeeze press": ["dumbbell", "incline dumbbell", "floor dumbbell", "alternating dumbbell", "tempo", "single arm dumbbell"],
      "Dip": ["assisted", "bodyweight", "chest focused", "tempo", "band assisted", "machine"],
      "Landmine chest press": ["single arm", "half-kneeling", "standing", "barbell", "tempo", "split stance"],
    },
    equipment: ["barbell", "dumbbell", "machine", "cable", "smith", "bodyweight"],
    kinds: ["compound", "compound", "accessory", "accessory"],
    cue: "Göğüs kafesini açık tutun, omuzları öne düşürmeden kontrollü itin.",
  },
  back: {
    families: [
      "Lat pulldown",
      "Seated row",
      "Chest supported row",
      "Pull-up",
      "Single-arm row",
      "Straight-arm pulldown",
      "T-bar row",
      "Meadows row",
      "Pullover",
      "Face pull row",
    ],
    variants: ["wide grip", "neutral grip", "single arm", "tempo", "pause rep", "machine"],
    equipment: ["cable", "machine", "dumbbell", "bodyweight", "barbell", "band"],
    kinds: ["compound", "compound", "accessory", "accessory"],
    cue: "Çekişi dirseklerle başlatın, kürek kemiklerini kontrollü geriye alın.",
  },
  shoulders: {
    families: [
      "Shoulder press",
      "Lateral raise",
      "Rear delt fly",
      "Front raise",
      "Arnold press",
      "Face pull",
      "Y raise",
      "Upright row",
      "Landmine press",
      "Cuban rotation",
    ],
    variants: ["dumbbell", "cable", "machine", "band", "seated", "single arm"],
    equipment: ["dumbbell", "cable", "machine", "band", "barbell", "bodyweight"],
    kinds: ["compound", "accessory", "accessory", "mobility"],
    cue: "Boynu sıkıştırmadan omuz hattını sabit tutun, hareketi kontrollü yapın.",
  },
  biceps: {
    families: [
      "Biceps curl",
      "Hammer curl",
      "Preacher curl",
      "Incline curl",
      "Spider curl",
      "Concentration curl",
      "Cable curl",
      "Reverse curl",
      "Zottman curl",
      "Drag curl",
    ],
    variants: ["barbell", "dumbbell", "cable", "machine", "tempo", "single arm"],
    equipment: ["barbell", "dumbbell", "cable", "machine", "band", "dumbbell"],
    kinds: ["accessory", "accessory", "accessory", "accessory"],
    cue: "Dirsekleri sabit tutun, ağırlığı sallamadan biceps ile kaldırın.",
  },
  triceps: {
    families: [
      "Rope pushdown",
      "Overhead extension",
      "Skull crusher",
      "Close-grip press",
      "Dip",
      "Kickback",
      "French press",
      "Cross-body extension",
      "Machine dip",
      "Single-arm pushdown",
    ],
    variants: ["cable", "dumbbell", "barbell", "machine", "tempo", "single arm"],
    equipment: ["cable", "dumbbell", "barbell", "machine", "bodyweight", "band"],
    kinds: ["accessory", "accessory", "compound", "accessory"],
    cue: "Üst kolu sabit tutun, dirseği tam kontrolle açıp kapatın.",
  },
  quadriceps: {
    families: [
      "Squat",
      "Leg press",
      "Hack squat",
      "Leg extension",
      "Split squat",
      "Lunge",
      "Step-up",
      "Front squat",
      "Sissy squat",
      "Cyclist squat",
    ],
    variants: ["barbell", "dumbbell", "machine", "smith", "tempo", "pause rep"],
    equipment: ["barbell", "dumbbell", "machine", "smith", "bodyweight", "box"],
    kinds: ["compound", "compound", "accessory", "compound"],
    tags: ["knee-caution"],
    cue: "Dizleri ayak yönünde takip ettirin, hareket derinliğini üyeye göre ayarlayın.",
  },
  hamstrings: {
    families: [
      "Romanian deadlift",
      "Leg curl",
      "Good morning",
      "Nordic curl",
      "Cable pull-through",
      "Single-leg RDL",
      "Glute-ham raise",
      "Hamstring slide",
      "Stiff-leg deadlift",
      "Kettlebell hinge",
    ],
    variants: ["barbell", "dumbbell", "machine", "cable", "tempo", "single leg"],
    equipment: ["barbell", "dumbbell", "machine", "cable", "mat", "kettlebell"],
    kinds: ["compound", "accessory", "compound", "accessory"],
    tags: ["back-caution"],
    cue: "Kalçayı geriye itin, bel pozisyonunu bozmadan arka bacak gerilimini hissedin.",
  },
  glutes: {
    families: [
      "Hip thrust",
      "Glute bridge",
      "Cable kickback",
      "Abductor",
      "Sumo squat",
      "Reverse lunge",
      "Frog pump",
      "Step-up glute focus",
      "Pull-through",
      "B-stance hip hinge",
    ],
    variants: ["barbell", "dumbbell", "machine", "cable", "band", "single leg"],
    equipment: ["barbell", "dumbbell", "machine", "cable", "band", "mat"],
    kinds: ["compound", "accessory", "accessory", "compound"],
    cue: "Belden değil kalçadan güç üretin, üst noktada kalçayı net sıkıştırın.",
  },
  calves: {
    families: [
      "Standing calf raise",
      "Seated calf raise",
      "Leg press calf raise",
      "Single-leg calf raise",
      "Donkey calf raise",
      "Tibialis raise",
      "Farmer walk on toes",
      "Smith calf raise",
      "Calf press",
      "Jump rope calf rhythm",
    ],
    variants: ["machine", "dumbbell", "smith", "bodyweight", "tempo", "single leg"],
    equipment: ["machine", "dumbbell", "smith", "bodyweight", "barbell", "mat"],
    kinds: ["accessory", "accessory", "conditioning", "accessory"],
    cue: "Tam esneme ve tam sıkışma kullanın, hareketi ayak bileğinden yapın.",
  },
  core: {
    families: [
      "Plank",
      "Side plank",
      "Dead bug",
      "Bird dog",
      "Cable crunch",
      "Pallof press",
      "Wood chop",
      "Reverse crunch",
      "Hollow hold",
      "Ab rollout",
    ],
    variants: ["mat", "cable", "band", "weighted", "tempo", "anti-rotation"],
    equipment: ["mat", "cable", "band", "dumbbell", "bodyweight", "medicineball"],
    kinds: ["core", "core", "accessory", "core"],
    cue: "Kaburgayı kapatın, bel boşluğunu büyütmeden merkez bölgeyi aktif tutun.",
  },
  cardio: {
    families: [
      "Treadmill interval",
      "Bike interval",
      "Elliptical tempo",
      "Rowing interval",
      "Stair climber",
      "Battle rope",
      "Sled push",
      "Air bike",
      "Brisk walk",
      "Shuttle run",
    ],
    variants: ["zone 2", "interval", "tempo", "sprint", "low impact", "endurance"],
    equipment: ["cardio", "cardio", "cardio", "rower", "sled", "bodyweight"],
    kinds: ["cardio", "conditioning", "cardio", "conditioning"],
    tags: ["low-impact"],
    cue: "Nabız hedefini koruyun, form bozulursa önce tempoyu azaltın.",
  },
  mobility: {
    families: [
      "Thoracic rotation",
      "Hip flexor stretch",
      "Hamstring mobility",
      "Ankle mobility",
      "Wall slide",
      "Cat-camel",
      "World's greatest stretch",
      "Foam roller release",
      "Shoulder CAR",
      "90/90 hip flow",
    ],
    variants: ["mat", "band", "bodyweight", "dynamic", "isometric", "flow"],
    equipment: ["mat", "band", "bodyweight", "pilatesball", "mat", "band"],
    kinds: ["mobility", "mobility", "mobility", "accessory"],
    tags: ["low-impact"],
    cue: "Ağrısız hareket aralığında kalın, nefesi tutmadan akışı tamamlayın.",
  },
  crossfit: {
    families: [
      "Clean",
      "Snatch",
      "Thruster",
      "Wall ball",
      "Box jump",
      "Burpee",
      "Kettlebell swing",
      "Toes-to-bar",
      "Double under",
      "Row calories",
    ],
    variants: ["skill", "EMOM", "AMRAP", "for time", "strength", "scaled"],
    equipment: ["barbell", "medicineball", "box", "bodyweight", "kettlebell", "rower", "rig"],
    kinds: ["conditioning", "compound", "cardio", "conditioning"],
    cue: "WOD temposunu üye seviyesine göre ölçekleyin, teknik bozulursa yükü düşürün.",
  },
  pilates: {
    families: [
      "Hundred",
      "Roll up",
      "Single leg stretch",
      "Double leg stretch",
      "Teaser",
      "Swan",
      "Footwork",
      "Leg circle",
      "Short spine",
      "Side kick series",
    ],
    variants: ["mat", "reformer", "chair", "cadillac", "ball", "band"],
    equipment: ["mat", "reformer", "pilateschair", "cadillac", "pilatesball", "band"],
    kinds: ["core", "mobility", "accessory", "core"],
    tags: ["low-impact"],
    cue: "Nefes, merkez kontrolü ve omurga hizasını koruyarak akışı tamamlayın.",
  },
};

const exerciseLibrary = buildExpandedExerciseLibrary();

function buildExpandedExerciseLibrary() {
  const baseExercises = exerciseGroups.flatMap((group) =>
    group.exercises.map((exercise, index) => ({
      ...exercise,
      id: `${group.id}-${index}`,
      group: group.id,
    })),
  );
  const expandedExercises = [];

  Object.entries(exerciseExpansionBlueprints).forEach(([groupId, blueprint]) => {
    let index = 0;

    blueprint.families.forEach((family) => {
      const variants = blueprint.familyVariants?.[family] || blueprint.variants;

      variants.forEach((variant) => {
        expandedExercises.push({
          id: `${groupId}-expanded-${index}`,
          group: groupId,
          name: buildExpandedExerciseName(variant, family),
          equipment: inferExerciseEquipment(variant, family, blueprint, index),
          kind: blueprint.kinds[index % blueprint.kinds.length],
          level: index % 5 === 0 ? "advanced" : index % 2 === 0 ? "intermediate" : "beginner",
          tags: blueprint.tags || [],
          cue: blueprint.cue,
        });
        index += 1;
      });
    });
  });

  return [...baseExercises, ...expandedExercises];
}

function buildExpandedExerciseName(variant, family) {
  const variantText = String(variant || "").trim();
  const familyText = String(family || "").trim();

  if (!variantText) {
    return titleCase(familyText);
  }

  if (familyText.toLowerCase().startsWith(variantText.toLowerCase())) {
    return titleCase(familyText);
  }

  return `${titleCase(variantText)} ${familyText}`;
}

function inferExerciseEquipment(variant, family, blueprint, index) {
  const text = `${variant || ""} ${family || ""}`.toLowerCase();

  if (text.includes("band")) return "band";
  if (text.includes("smith")) return "smith";
  if (text.includes("cable")) return "cable";
  if (text.includes("dumbbell")) return "dumbbell";
  if (text.includes("barbell") || text.includes("landmine")) return "barbell";
  if (text.includes("machine") || text.includes("pec deck") || text.includes("assisted") || text.includes("iso-lateral") || text.includes("plate loaded")) return "machine";
  if (text.includes("push-up") || text.includes("dip")) return "bodyweight";
  if (text.includes("chest fly") || text.includes("squeeze press")) return "dumbbell";
  if (text.includes("bench press") || text.includes("incline press") || text.includes("decline press")) return "barbell";

  return blueprint.equipment[index % blueprint.equipment.length];
}
  window.BSMExerciseData = {
    exerciseGroups,
    exerciseExpansionBlueprints,
    exerciseLibrary,
  };
})();
