import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container">
      <section className="brand-bar">
        <a href="/dashboard" className="brand-secco" aria-label="Secco">
          <img src="/assets/secco-logo.svg" alt="Secco logo" />
        </a>
        <div className="brand-divider" aria-hidden="true" />
        <a
          href="https://www.wartsila.com"
          target="_blank"
          rel="noreferrer"
          className="brand-wartsila"
          aria-label="Wartsila"
        >
          <img src="/assets/wartsila-logo.png" alt="Wartsila logo" />
        </a>
      </section>

      <section className="home-hero">
        <div className="home-hero-overlay" />
        <div className="home-hero-content">
          <p className="home-kicker">Industrias Juan F. Secco</p>
          <h1>Resultados Análisis de Aceite Centrales Wärtsilä</h1>
          <p>
            Plataforma de seguimiento técnico para muestras, tendencias operativas y exportación
            de resultados.
          </p>
          <div className="home-cta-row">
            <Link href="/dashboard" className="home-cta">
              Ingresar a la Plataforma
            </Link>
          </div>
        </div>
      </section>

      <section className="home-grid">
        <article className="home-panel">
          <h2>Control Operativo</h2>
          <p>
            Visualiza el estado de desgaste, contaminantes, agua y condición del fluido para cada
            equipo.
          </p>
        </article>
        <article className="home-panel">
          <h2>Trazabilidad</h2>
          <p>
            Consulta histórico de muestras, compara últimas mediciones y exporta informes PDF por
            número de muestra.
          </p>
        </article>
        <article className="home-panel">
          <h2>Monitoreo Ágil</h2>
          <p>
            Filtra por área y equipo para analizar más rápido el comportamiento de las centrales.
          </p>
        </article>
      </section>
    </main>
  );
}

