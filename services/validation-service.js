(function () {
  "use strict";

  function validateFormData(data) {
    return buildFormValidationErrors(data)[0] || "";
  }

  function buildFormValidationErrors(data) {
    const errors = [];

    if (!data.memberName && !data.memberCode) {
      errors.push("Program oluşturmak için en az üye adı veya üye no girin.");
    }

    if (!data.goal || !data.level || !data.programStyle || !data.trainingSystem || !data.equipmentScope) {
      errors.push("Lütfen hedef, seviye, program tipi, antrenman sistemi ve ekipman kapsamı alanlarını doldurun.");
    }

    if ((data.days || []).length < 2 || (data.days || []).length > 6) {
      errors.push("Üye programı için en az 2, en fazla 6 gün seçmeniz gerekir.");
    }

    if (!data.gymName) {
      errors.push("Fitness merkezi adı boş bırakılamaz.");
    }

    if (![30, 45, 60, 75].includes(Number(data.duration))) {
      errors.push("Seans süresi desteklenen seçeneklerden biri olmalıdır.");
    }

    return errors;
  }

  function validateMeasurementData(measurement, helpers) {
    const { parseCalendarInputDate } = helpers || {};
    const errors = [];
    const hasAnyBirthPart = [measurement.birthDay, measurement.birthMonth, measurement.birthYear].some((value) => value !== "");
    const hasAllBirthParts = [measurement.birthDay, measurement.birthMonth, measurement.birthYear].every((value) => value !== "");

    if (hasAnyBirthPart && !hasAllBirthParts) {
      errors.push("Doğum tarihi için gün, ay ve yıl alanlarının üçünü de girin.");
    }

    if (hasAllBirthParts && !measurement.birthDate) {
      errors.push("Doğum tarihi geçerli görünmüyor. Gün, ay ve yıl bilgisini kontrol edin.");
    }

    if (hasAllBirthParts && measurement.date && measurement.birthDate && typeof parseCalendarInputDate === "function") {
      const birthDate = parseCalendarInputDate(measurement.birthDate);
      const referenceDate = parseCalendarInputDate(measurement.date);

      if (birthDate && referenceDate && birthDate > referenceDate) {
        errors.push("Doğum tarihi ölçüm tarihinden ileri olamaz.");
      }
    }

    if (measurement.weight !== "" && (measurement.weight < 20 || measurement.weight > 250)) {
      errors.push("Kilo değeri 20 ile 250 kg arasında olmalıdır.");
    }

    if (measurement.height !== "" && (measurement.height < 100 || measurement.height > 240)) {
      errors.push("Boy değeri 100 ile 240 cm arasında olmalıdır.");
    }

    if (measurement.age !== "" && (measurement.age < 10 || measurement.age > 100)) {
      errors.push("Hesaplanan yaş 10 ile 100 arasında olmalıdır.");
    }

    if (measurement.fat !== "" && (measurement.fat < 3 || measurement.fat > 60)) {
      errors.push("Vücut yağ oranı %3 ile %60 arasında olmalıdır.");
    }

    if (measurement.metabolicAge !== "" && measurement.age !== "" && measurement.metabolicAge < measurement.age - 25) {
      errors.push("Metabolizma yaşı girilen doğum tarihine göre olağan dışı düşük görünüyor.");
    }

    return errors[0] || "";
  }

  window.BSMValidationService = {
    validateFormData,
    buildFormValidationErrors,
    validateMeasurementData,
  };
})();
