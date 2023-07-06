<script>
  export let look;
</script>

<style>

nav {
    position: absolute;
    top: 3vh;
    right: 4vw;
    display: grid;
    grid-gap: 0 .5em;
    grid-template-columns: 1fr 1fr 1fr;
    font-size: 2vh;
}

svg {
    height: 1em;
    padding: 0.5em;
    border-radius: .625em;
    color: white;
    background: var(--blue);
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: background .2s, transform .25s;
}

svg:hover {
  background: var(--orange);
  transform: scale(1.2);
}

</style>

<nav
  on:mouseenter={() => { look.set(true) }}
  on:mouseleave={() => look.set(false)}
  on:touchstart|capture={() => look.set(true)}
  on:touchend|capture={() => look.set(false)}
  on:touchcancel|capture={() => look.set(false)}    
  >
  <a href="https://github.com/Bhavkumar21">
    <svg
      viewBox="0 0 24 24"
      preserveAspectRatio="xMidYMid"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      fill="none"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      >
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  </a>
  
  <a href="https://www.linkedin.com/in/bhavkumar/">
    <svg
      viewBox="0 0 24 24"
      preserveAspectRatio="xMidYMid"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      fill="none"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-5.052 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z"/>
    </svg>      
  </a>
  
  <a href="https://www.kaggle.com/bhavkumar">
    <svg
      viewBox="0 0 24 24"
      preserveAspectRatio="xMidYMid"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      fill="none"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M18.825 23.859c-.022.092-.117.141-.281.141h-3.139c-.187 0-.351-.082-.492-.248l-5.178-6.589-1.448 1.374v5.111c0 .235-.117.352-.351.352H5.505c-.236 0-.354-.117-.354-.352V.353c0-.233.118-.353.354-.353h2.431c.234 0 .351.12.351.353v14.343l6.203-6.272c.165-.165.33-.246.495-.246h3.239c.144 0 .236.06.285.18.046.149.034.255-.036.315l-6.555 6.344 6.836 8.507c.095.104.117.208.07.358"/>
    </svg>      
  </a>
</nav>
