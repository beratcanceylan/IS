import { guessLocation } from '@/data/locations';
import type { NormalizedJob } from '@/domain/job';

import { extractEducation } from './education';
import { extractKpss } from './kpss';
import {
  extractAge,
  extractDriverLicense,
  extractEmploymentType,
  extractExperience,
  extractForeignLanguage,
  extractLegalStatus,
  extractMilitary,
  extractPublicEmploymentType,
  extractQuotaFromTitle,
  extractSalary,
  extractWorkModel,
} from './requirements';

/**
 * Adapter'ın doldurduğu alanları EZMEDEN, boş kalan alanları ilan metninden deterministik
 * olarak tamamlar. Kaynak bir alanı açıkça verdiyse o değer her zaman önceliklidir.
 */
export function enrichFromText(job: NormalizedJob): NormalizedJob {
  const body = [job.description, job.requirements].filter(Boolean).join('\n');
  const all = [job.title, job.employmentCategory, body].filter(Boolean).join('\n');
  const out: NormalizedJob = { ...job };

  if (out.kpssRequired === null && out.kpssScoreTypes.length === 0) {
    const k = extractKpss(all);
    out.kpssRequired = k.required;
    out.kpssScoreTypes = k.scoreTypes;
    out.kpssMinimumScore = out.kpssMinimumScore ?? k.minimumScore;
    out.kpssYear = out.kpssYear ?? k.year;
  }

  if (out.educationLevels.length === 0) out.educationLevels = extractEducation(all);

  if (out.ageMin === null && out.ageMax === null) {
    const age = extractAge(body);
    out.ageMin = age.min;
    out.ageMax = age.max;
  }

  if (out.experienceYearsMin === null && out.experienceText === null) {
    const exp = extractExperience(body);
    out.experienceText = exp.text;
    out.experienceYearsMin = exp.yearsMin;
  }

  if (out.salaryMin === null && out.salaryMax === null && out.salaryText === null) {
    const s = extractSalary(body);
    out.salaryMin = s.min;
    out.salaryMax = s.max;
    out.salaryText = s.text;
  }

  out.quota ??= extractQuotaFromTitle(job.title);

  if (out.sector === 'public' && out.publicEmploymentType === null) {
    out.publicEmploymentType = extractPublicEmploymentType(job.employmentCategory, job.title, body);
  }
  out.legalStatus ??= extractLegalStatus(body);
  if (out.employmentType === 'unknown') out.employmentType = extractEmploymentType(job.title, job.employmentCategory, body);
  if (out.workModel === 'unknown') out.workModel = extractWorkModel(job.title, body);

  out.driverLicenseRequirement ??= extractDriverLicense(body);
  out.militaryRequirement ??= extractMilitary(body);
  out.foreignLanguageRequirement ??= extractForeignLanguage(body);

  if (out.city === null) {
    // Konum yalnızca kurum adı ve başlıktan çıkarılır; uzun metinde geçen şehir adları
    // (örn. "Ankara'da yapılacak sınav") yanıltıcı olabilir.
    const loc = guessLocation(job.organization, job.title);
    out.city = loc.city;
    out.district = out.district ?? loc.district;
  }

  return out;
}
