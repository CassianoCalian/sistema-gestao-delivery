import { NextResponse } from "next/server";

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cep: string }> },
) {
  try {
    const { cep } = await params;

    const cepLimpo = cep.replace(/\D/g, "");

    if (cepLimpo.length !== 8) {
      return NextResponse.json(
        { erro: "CEP inválido. Informe os 8 números do CEP." },
        { status: 400 },
      );
    }

    const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, {
      cache: "no-store",
    });

    if (!resposta.ok) {
      return NextResponse.json(
        { erro: "Não foi possível consultar o CEP." },
        { status: 502 },
      );
    }

    const endereco: ViaCepResponse = await resposta.json();

    if (endereco.erro) {
      return NextResponse.json(
        { erro: "CEP não encontrado." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      cep: endereco.cep ?? "",
      rua: endereco.logradouro ?? "",
      bairro: endereco.bairro ?? "",
      cidade: endereco.localidade ?? "",
      uf: endereco.uf ?? "",
    });
  } catch (error) {
    console.error("Erro ao consultar CEP:", error);

    return NextResponse.json(
      { erro: "Ocorreu um erro ao consultar o CEP." },
      { status: 500 },
    );
  }
}
