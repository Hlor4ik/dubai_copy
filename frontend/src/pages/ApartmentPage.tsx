import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Apartment } from '../types';
import styles from './ApartmentPage.module.css';

export default function ApartmentPage() {
  const { landingId } = useParams<{ landingId: string }>();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    async function fetchApartment() {
      try {
        const response = await fetch(`/api/apartment/${landingId}`);
        if (!response.ok) {
          throw new Error('Apartment not found');
        }
        const data = await response.json();
        setApartment(data);
      } catch {
        setError('Квартира не найдена');
      } finally {
        setLoading(false);
      }
    }

    if (landingId) {
      fetchApartment();
    }
  }, [landingId]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Загрузка...</p>
      </div>
    );
  }

  if (error || !apartment) {
    return (
      <div className={styles.error}>
        <h1>Страница не найдена</h1>
        <p>{error || 'Квартира не найдена'}</p>
        <Link to="/" className={styles.backLink}>
          Вернуться на главную
        </Link>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <motion.header
        className={styles.header}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Link to="/" className={styles.logo}>
          <span className={styles.logoIcon}>◆</span>
          <span className={styles.logoText}>Dubai AI</span>
        </Link>
      </motion.header>

      {/* Hero Section */}
      <motion.section
        className={styles.hero}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <div className={styles.heroOverlay} />
        <img
          src={apartment.images[activeImage]}
          alt={`${apartment.district} apartment`}
          className={styles.heroImage}
        />
        <div className={styles.heroContent}>
          <motion.p
            className={styles.badge}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Квартира, подобранная для вас ИИ-консультантом
          </motion.p>
          <motion.h1
            className={styles.heroTitle}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {apartment.district}
          </motion.h1>
          <motion.p
            className={styles.heroPrice}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            {formatPrice(apartment.price)} AED
          </motion.p>
        </div>
      </motion.section>

      {/* Gallery */}
      <section className={styles.gallery}>
        <div className={styles.galleryGrid}>
          {apartment.images.map((image, index) => (
            <motion.button
              key={index}
              className={`${styles.galleryItem} ${index === activeImage ? styles.active : ''}`}
              onClick={() => setActiveImage(index)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
            >
              <img src={image} alt={`View ${index + 1}`} />
            </motion.button>
          ))}
        </div>
      </section>

      {/* Details */}
      <section className={styles.details}>
        <div className={styles.container}>
          <div className={styles.detailsGrid}>
            {/* Stats */}
            <motion.div
              className={styles.stats}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Район</span>
                <span className={styles.statValue}>{apartment.district}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Площадь</span>
                <span className={styles.statValue}>{apartment.area} м²</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Этаж</span>
                <span className={styles.statValue}>{apartment.floor}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Цена</span>
                <span className={styles.statValue}>{formatPrice(apartment.price)} AED</span>
              </div>
            </motion.div>

            {/* Description */}
            <motion.div
              className={styles.description}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <h2 className={styles.sectionTitle}>Описание</h2>
              <p className={styles.descriptionText}>{apartment.description}</p>
            </motion.div>
          </div>

          {/* CTA */}
          <motion.div
            className={styles.cta}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <button className={styles.ctaButton}>
              Связаться с менеджером
            </button>
            <p className={styles.ctaHint}>
              Наш специалист свяжется с вами в ближайшее время
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>© 2024 Dubai AI Consultant. Демонстрационная версия.</p>
        <Link to="/">Начать новый подбор</Link>
      </footer>
    </div>
  );
}

