import { NextResponse } from "next/server";
import { commercialize } from "@/lib/commercialization";

export async function POST(req:Request){
  try{
    const body=await req.json();
    if(!body.name || !body.description) return NextResponse.json({error:"name and description are required"},{status:400});
    const result=await commercialize({name:String(body.name),description:String(body.description),type:String(body.type||"code")});
    return NextResponse.json(result);
  }catch(error){
    console.error(error);
    return NextResponse.json({error:"Commercialization analysis failed"},{status:500});
  }
}
