import TankGame from "@/components/TankGame";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#0b0b0b] to-[#141414] p-4">
      <h1 className="mb-2 font-mono text-4xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-200">
        TANK BATTLE
      </h1>
      <p className="mb-6 font-mono text-sm text-gray-400">坦克大战 · Next.js</p>
      <TankGame />
    </main>
  );
}
