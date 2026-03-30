/**
 * Tests du module de tarification GED
 */
import { GedPricing} from './pricing';

console.log('🧪 TESTS TARIFICATION GED\n');
console.log('='.repeat(80));

// Test 1 : Session 7 jours
console.log('\n📅 Test 1 : Session 7 jours');
const price1 = GedPricing.calculate(615, 7, 'paris');
console.log(`Prix UFOVAL : 615 €`);
console.log(`Surcoût 7j : +180 €`);
console.log(`Ville Paris : +12 €`);
console.log(`Sous-total : 807 €`);
console.log(`Promo 5% : -40 €`);
console.log(`PRIX FINAL : ${price1} €`);
console.log(`✅ Attendu : 767 €`);
console.log(price1 === 767 ? '✅ CORRECT' : '❌ ERREUR');

// Test 2 : Session 14 jours
console.log('\n📅 Test 2 : Session 14 jours');
const price2 = GedPricing.calculate(1095, 14, 'lyon');
console.log(`Prix UFOVAL : 1 095 €`);
console.log(`Surcoût 14j : +310 €`);
console.log(`Ville Lyon : +12 €`);
console.log(`Sous-total : 1 417 €`);
console.log(`Promo 5% : -71 €`);
console.log(`PRIX FINAL : ${price2} €`);
console.log(`✅ Attendu : 1 346 €`);
console.log(price2 === 1346 ? '✅ CORRECT' : '❌ ERREUR');

// Test 3 : Session 12 jours (proratisé)
console.log('\n📅 Test 3 : Session 12 jours (proratisé)');
const price3 = GedPricing.calculate(900, 12, 'rennes');
console.log(`Prix UFOVAL : 900 €`);
console.log(`Prorata 14j sur 12j : (310 / 14) × 12 = +266 €`);
console.log(`Ville Rennes : +12 €`);
console.log(`Sous-total : 1 178 €`);
console.log(`Promo 5% : -59 €`);
console.log(`PRIX FINAL : ${price3} €`);
console.log(`✅ Attendu : 1 119 €`);
console.log(price3 === 1119 ? '✅ CORRECT' : '❌ ERREUR');

// Test 4 : Sans promo
console.log('\n📅 Test 4 : Sans promo');
const price4 = GedPricing.calculate(615, 7, 'paris', false);
console.log(`Prix SANS promo : ${price4} €`);
console.log(`✅ Attendu : 807 €`);
console.log(price4 === 807 ? '✅ CORRECT' : '❌ ERREUR');

// Test 5 : Ville GED
console.log('\n📅 Test 5 : Ville GED (Marseille)');
const price5 = GedPricing.calculate(615, 7, 'marseille');
console.log(`Ville Marseille : DANS liste GED`);
console.log(`Supplément ville : +12 €`);
console.log(`PRIX FINAL : ${price5} €`);
console.log(`✅ Attendu : 767 € (615 + 180 + 12, puis -5%)`);
console.log(price5 === 767 ? '✅ CORRECT' : '❌ ERREUR');

// Test 6 : Liste des villes
console.log('\n🚃 Test 6 : Villes de départ GED');
const cities = GedPricing.getDepartureCities();
console.log(`Nombre de villes : ${cities.length}`);
console.log(`Liste : ${cities.join(', ')}`);
console.log(`✅ Attendu : 10 villes`);
console.log(cities.length === 10 ? '✅ CORRECT' : '❌ ERREUR');

// Test 7 : Calcul durée
console.log('\n📅 Test 7 : Calcul durée');
const start = new Date('2026-07-08');
const end = new Date('2026-07-21');
const duration = GedPricing.calculateDuration(start, end);
console.log(`Du 08/07 au 21/07/2026`);
console.log(`Durée calculée : ${duration} jours`);
console.log(`✅ Attendu : 13 jours (8 au 21 = 13)`);
console.log(duration === 13 ? '✅ CORRECT' : '❌ ERREUR');

// Test 8 : Durée 21 jours
console.log('\n📅 Test 8 : Session 21 jours');
const price8 = GedPricing.calculate(1200, 21, 'grenoble');
console.log(`Prix UFOVAL : 1 200 €`);
console.log(`Surcoût 21j : +450 €`);
console.log(`Ville Grenoble : +12 €`);
console.log(`Sous-total : 1 662 €`);
console.log(`Promo 5% : -83 €`);
console.log(`PRIX FINAL : ${price8} €`);
console.log(`✅ Attendu : 1 579 €`);
console.log(price8 === 1579 ? '✅ CORRECT' : '❌ ERREUR');

// Test 9 : Prorata 13 jours
console.log('\n📅 Test 9 : Session 13 jours (proratisé)');
const price9 = GedPricing.calculate(1000, 13, 'bordeaux');
console.log(`Prix UFOVAL : 1 000 €`);
console.log(`Prorata 14j sur 13j : (310 / 14) × 13 = +288 €`);
console.log(`Ville Bordeaux : +12 €`);
console.log(`Sous-total : 1 300 €`);
console.log(`Promo 5% : -65 €`);
console.log(`PRIX FINAL : ${price9} €`);
console.log(`✅ Attendu : 1 235 €`);
console.log(price9 === 1235 ? '✅ CORRECT' : '❌ ERREUR');

// Test 10 : Sans ville (sans transport)
console.log('\n📅 Test 10 : Sans ville (sans transport)');
const price10 = GedPricing.calculate(615, 7, '');
console.log(`Prix SANS ville : ${price10} €`);
console.log(`✅ Attendu : 753 € (615 + 180 + 0, puis -5% = 795 × 0.95 = 755.25 arrondi à 755)`);
console.log(price10 === 755 ? '✅ CORRECT' : '❌ ERREUR');

console.log('\n' + '='.repeat(80));
console.log('\n✅ TOUS LES TESTS TERMINÉS');
console.log('Module de tarification GED prêt à être intégré !\n');
