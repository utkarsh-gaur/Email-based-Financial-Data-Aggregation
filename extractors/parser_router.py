from extractors.hdfc_parser import HDFCParser
from extractors.icici_parser import ICICIParser
from extractors.sbi_parser import SBIParser
from extractors.axis_parser import AxisParser
from extractors.kotak_parser import KotakParser
from extractors.canara_parser import CanaraParser

def get_parser(bank_name: str):
    if not bank_name:
        return None
    b = bank_name.strip().upper()
    match b:
        case "HDFC":
            return HDFCParser()
        case "ICICI":
            return ICICIParser()
        case "SBI":
            return SBIParser()
        case "AXIS":
            return AxisParser()
        case "KOTAK":
            return KotakParser()
        case "CANARA":
            return CanaraParser()
        case _:
            return None
